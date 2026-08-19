use serde::{de::IgnoredAny, Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::hash_map::DefaultHasher,
    fs::{self, File},
    hash::{Hash, Hasher},
    io::BufReader,
    path::{Path, PathBuf},
    process::{Command, Output, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::UNIX_EPOCH,
};
use tauri::Manager;

mod damf;

static DAMF_RENDER_CANCELLED: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaProbe {
    file_name: String,
    format_name: String,
    format_long_name: String,
    codec_name: String,
    codec_long_name: String,
    profile: String,
    sample_rate: u32,
    channels: u32,
    channel_layout: String,
    bitrate: u64,
    duration: f64,
    atmos: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedSource {
    playback_path: String,
    timeline_path: Option<String>,
    probe: MediaProbe,
    engine: String,
    source_kind: String,
    object_count: Option<u32>,
    cached: bool,
    warning: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProbeDocument {
    #[serde(default)]
    streams: Vec<Value>,
    #[serde(default)]
    format: Value,
}

fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    command
}

fn bundled_tool_or_path(name: &str) -> PathBuf {
    let executable = format!("{name}.exe");
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let bundled = parent.join(&executable);
            if bundled.is_file() {
                return bundled;
            }
        }
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("bin")
        .join(format!("{name}-x86_64-pc-windows-msvc.exe"));
    if development.is_file() {
        return development;
    }
    PathBuf::from(name)
}

fn command_error(label: &str, output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let details = if !stderr.is_empty() { stderr } else { stdout };
    if details.is_empty() {
        format!("{label} failed with exit code {:?}.", output.status.code())
    } else {
        format!("{label} failed: {details}")
    }
}

fn export_partial_path(destination: &Path) -> Result<PathBuf, String> {
    let file_name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The export destination has no valid file name.".to_owned())?;
    Ok(destination.with_file_name(format!(".{file_name}.partial")))
}

fn validate_export_destination(
    source: &Path,
    destination: &Path,
    extensions: &[&str],
) -> Result<PathBuf, String> {
    if !source.is_file() {
        return Err("The selected source file no longer exists.".to_owned());
    }
    let extension = destination
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    if !extensions
        .iter()
        .any(|allowed| extension.eq_ignore_ascii_case(allowed))
    {
        return Err(format!(
            "The export destination must use one of these extensions: {}.",
            extensions
                .iter()
                .map(|extension| format!(".{extension}"))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    let parent = destination
        .parent()
        .filter(|parent| parent.is_dir())
        .ok_or_else(|| "The export destination directory does not exist.".to_owned())?;
    let source = source
        .canonicalize()
        .map_err(|error| format!("Could not resolve the source file: {error}"))?;
    let destination_name = destination
        .file_name()
        .ok_or_else(|| "The export destination has no file name.".to_owned())?;
    let resolved_destination = parent
        .canonicalize()
        .map_err(|error| format!("Could not resolve the export directory: {error}"))?
        .join(destination_name);
    if resolved_destination == source {
        return Err("Choose a different destination from the source file.".to_owned());
    }
    Ok(resolved_destination)
}

fn promote_export(partial: &Path, destination: &Path, label: &str) -> Result<u64, String> {
    let bytes = fs::metadata(partial)
        .map_err(|error| format!("{label} did not produce an output file: {error}"))?
        .len();
    if bytes == 0 {
        let _ = fs::remove_file(partial);
        return Err(format!("{label} produced an empty output file."));
    }
    if destination.is_file() {
        fs::remove_file(destination)
            .map_err(|error| format!("Could not replace the existing export: {error}"))?;
    }
    fs::rename(partial, destination)
        .map_err(|error| format!("Could not finalize the export: {error}"))?;
    Ok(bytes)
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn number_from_string(value: &Value, key: &str) -> f64 {
    value
        .get(key)
        .and_then(Value::as_str)
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or_default()
}

fn probe_path(path: &Path) -> Result<MediaProbe, String> {
    if !path.is_file() {
        return Err("The selected media file does not exist.".to_owned());
    }

    let output = hidden_command(bundled_tool_or_path("ffprobe"))
        .args([
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
        ])
        .arg(path)
        .output()
        .map_err(|error| {
            format!(
                "ffprobe is required to inspect local media, but it could not be started: {error}"
            )
        })?;
    if !output.status.success() {
        return Err(command_error("Media inspection", &output));
    }

    let document: ProbeDocument = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("ffprobe returned invalid JSON: {error}"))?;
    let stream = document
        .streams
        .iter()
        .find(|stream| stream.get("codec_type").and_then(Value::as_str) == Some("audio"))
        .ok_or_else(|| "The selected file contains no audio stream.".to_owned())?;

    let codec_name = string_field(stream, "codec_name");
    let profile = string_field(stream, "profile");
    let sample_rate = string_field(stream, "sample_rate")
        .parse()
        .unwrap_or_default();
    let channels = stream
        .get("channels")
        .and_then(Value::as_u64)
        .unwrap_or_default() as u32;
    let duration = {
        let stream_duration = number_from_string(stream, "duration");
        if stream_duration > 0.0 {
            stream_duration
        } else {
            number_from_string(&document.format, "duration")
        }
    };
    let bitrate = {
        let stream_rate = string_field(stream, "bit_rate").parse().unwrap_or_default();
        if stream_rate > 0 {
            stream_rate
        } else {
            string_field(&document.format, "bit_rate")
                .parse()
                .unwrap_or_default()
        }
    };
    let profile_lower = profile.to_lowercase();
    let format_name = string_field(&document.format, "format_name");

    Ok(MediaProbe {
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Local media")
            .to_owned(),
        format_name,
        format_long_name: string_field(&document.format, "format_long_name"),
        codec_name: codec_name.clone(),
        codec_long_name: string_field(stream, "codec_long_name"),
        profile,
        sample_rate,
        channels,
        channel_layout: string_field(stream, "channel_layout"),
        bitrate,
        duration,
        atmos: codec_name.eq_ignore_ascii_case("eac3")
            && (profile_lower.contains("atmos") || profile_lower.contains("joc")),
    })
}

fn cache_key(path: &Path) -> Result<String, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Could not read source metadata: {error}"))?;
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().to_lowercase().hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        if let Ok(since_epoch) = modified.duration_since(UNIX_EPOCH) {
            since_epoch.as_nanos().hash(&mut hasher);
        }
    }
    Ok(format!("{:016x}", hasher.finish()))
}

fn prepared_cache_root(app: &tauri::AppHandle, path: &Path) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("Could not resolve the application cache directory: {error}"))?
        .join("prepared-media")
        .join(cache_key(path)?))
}

fn probe_any_path(path: &Path) -> Result<MediaProbe, String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default();
    if extension.eq_ignore_ascii_case("atmos") {
        let info = damf::inspect(path)?;
        return Ok(MediaProbe {
            file_name: info.file_name,
            format_name: "damf".to_owned(),
            format_long_name: "Dolby Atmos Master Fileset".to_owned(),
            codec_name: "pcm_s24le".to_owned(),
            codec_long_name: "PCM signed 24-bit object/bed essence".to_owned(),
            profile: "Dolby Atmos master".to_owned(),
            sample_rate: info.sample_rate,
            channels: info.channels,
            channel_layout: format!("10 bed + {} authored objects", info.object_count),
            bitrate: u64::from(info.sample_rate) * u64::from(info.channels) * 24,
            duration: info.duration,
            atmos: true,
        });
    }
    probe_path(path)
}

fn locate_openjoc(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let triple_name = "openjoc-x86_64-pc-windows-msvc.exe";
    let mut candidates = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join("openjoc.exe"));
            candidates.push(parent.join(triple_name));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("bin").join("openjoc.exe"));
        candidates.push(resource_dir.join("bin").join(triple_name));
        candidates.push(resource_dir.join("openjoc.exe"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("bin")
            .join(triple_name),
    );

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "The bundled OpenJOC renderer could not be located.".to_owned())
}

fn render_with_ffmpeg(source: &Path, output_path: &Path) -> Result<(), String> {
    let output = hidden_command(bundled_tool_or_path("ffmpeg"))
        .args(["-v", "error", "-y", "-i"])
        .arg(source)
        .args([
            "-map",
            "0:a:0",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-c:a",
            "pcm_f32le",
        ])
        .arg(output_path)
        .output()
        .map_err(|error| {
            format!(
                "ffmpeg is required to prepare this source, but it could not be started: {error}"
            )
        })?;
    if output.status.success() {
        Ok(())
    } else {
        Err(command_error("Audio conversion", &output))
    }
}

fn speaker_labels(layout: &str) -> Result<&'static [&'static str], String> {
    match layout {
        "2.0" => Ok(&["L", "R"]),
        "5.1" => Ok(&["L", "R", "C", "LFE", "Ls", "Rs"]),
        "7.1" => Ok(&["L", "R", "C", "LFE", "Ls", "Rs", "Lrs", "Rrs"]),
        "7.1.4" => Ok(&[
            "L", "R", "C", "LFE", "Ls", "Rs", "Lrs", "Rrs", "Ltf", "Rtf", "Ltr", "Rtr",
        ]),
        _ => Err("Unsupported speaker layout. Choose 2.0, 5.1, 7.1, or 7.1.4.".to_owned()),
    }
}

fn render_with_openjoc(
    renderer: &Path,
    source: &Path,
    output_path: &Path,
    layout: &str,
) -> Result<(), String> {
    speaker_labels(layout)?;
    let log_path = output_path.with_extension("openjoc.log");
    let stdout = File::create(&log_path)
        .map_err(|error| format!("Could not create the OpenJOC log: {error}"))?;
    let stderr = stdout
        .try_clone()
        .map_err(|error| format!("Could not prepare the OpenJOC log: {error}"))?;
    let status = hidden_command(renderer)
        .arg("render-joc")
        .arg(source)
        .args(["--layout", layout, "--output"])
        .arg(output_path)
        .args(["--no-progress", "--overwrite"])
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .status()
        .map_err(|error| format!("OpenJOC could not be started: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        let details = fs::read_to_string(log_path).unwrap_or_default();
        if details.trim().is_empty() {
            Err(format!(
                "OpenJOC Atmos render failed with exit code {:?}.",
                status.code()
            ))
        } else {
            Err(format!("OpenJOC Atmos render failed: {}", details.trim()))
        }
    }
}

fn inspect_openjoc_object_count(renderer: &Path, source: &Path, cache_dir: &Path) -> Option<u32> {
    let report_path = cache_dir.join("oamd-first-frame.json");
    if !report_path.is_file() {
        let output = hidden_command(renderer)
            .arg("diagnose-oamd")
            .arg(source)
            .args(["--access-unit", "0", "--json"])
            .arg(&report_path)
            .arg("--force")
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
    }

    let report: Value = serde_json::from_slice(&fs::read(report_path).ok()?).ok()?;
    report
        .get("observations")?
        .as_array()?
        .first()?
        .get("vendor_oamd")?
        .get("object_count")?
        .as_u64()
        .and_then(|value| u32::try_from(value).ok())
}

fn prepare_source(app: &tauri::AppHandle, path: &Path) -> Result<PreparedSource, String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if extension == "atmos" {
        let cache_root = prepared_cache_root(app, path)?;
        let prepared = damf::prepare(path, &cache_root)?;
        let info = prepared.info;
        return Ok(PreparedSource {
            playback_path: prepared.playback_path.to_string_lossy().into_owned(),
            timeline_path: Some(prepared.timeline_path.to_string_lossy().into_owned()),
            probe: MediaProbe {
                file_name: info.file_name,
                format_name: "damf".to_owned(),
                format_long_name: "Dolby Atmos Master Fileset".to_owned(),
                codec_name: "pcm_s24le".to_owned(),
                codec_long_name: "PCM signed 24-bit object/bed essence".to_owned(),
                profile: "Dolby Atmos master".to_owned(),
                sample_rate: info.sample_rate,
                channels: info.channels,
                channel_layout: format!("10 bed + {} authored objects", info.object_count),
                bitrate: u64::from(info.sample_rate) * u64::from(info.channels) * 24,
                duration: info.duration,
                atmos: true,
            },
            engine: "Native DAMF parser · authored PCM/metadata · 2.0 preview renderer".to_owned(),
            source_kind: "damf-master".to_owned(),
            object_count: Some(info.object_count),
            cached: prepared.cached,
            warning: Some("DAMF positions and object PCM are authored source data. The audible 2.0 monitor path uses this app's independent equal-power preview renderer with automatic make-up gain and compression, not Dolby's licensed renderer.".to_owned()),
        });
    }

    let probe = probe_path(path)?;

    if extension == "wav"
        && matches!(
            probe.codec_name.as_str(),
            "pcm_s16le" | "pcm_s24le" | "pcm_s32le" | "pcm_f32le" | "pcm_f64le"
        )
    {
        return Ok(PreparedSource {
            playback_path: path.to_string_lossy().into_owned(),
            timeline_path: None,
            probe,
            engine: "Native PCM playback".to_owned(),
            source_kind: "local-audio".to_owned(),
            object_count: None,
            cached: false,
            warning: None,
        });
    }

    let cache_root = prepared_cache_root(app, path)?;
    fs::create_dir_all(&cache_root)
        .map_err(|error| format!("Could not create the media cache: {error}"))?;
    let playback_path = cache_root.join("playback.wav");
    let render_kind_path = cache_root.join("render-kind.txt");
    let was_cached = playback_path.is_file()
        && fs::metadata(&playback_path)
            .map(|m| m.len() > 44)
            .unwrap_or(false);

    let mut warning = None;
    let (engine, source_kind, object_count) = if probe.atmos {
        let renderer = locate_openjoc(app)?;
        let mut used_openjoc = if was_cached {
            fs::read_to_string(&render_kind_path)
                .map(|value| value.trim() != "codec-core-fallback")
                .unwrap_or(true)
        } else {
            true
        };
        if !was_cached {
            if let Err(openjoc_error) = render_with_openjoc(&renderer, path, &playback_path, "2.0")
            {
                render_with_ffmpeg(path, &playback_path)?;
                used_openjoc = false;
                let _ = fs::write(&render_kind_path, "codec-core-fallback");
                warning = Some(format!(
                    "OpenJOC could not render the JOC payload, so playback uses the codec-core channel downmix. {openjoc_error}"
                ));
            } else {
                let _ = fs::write(&render_kind_path, "openjoc");
            }
        }
        let object_count = inspect_openjoc_object_count(&renderer, path, &cache_root);
        if !used_openjoc {
            if warning.is_none() {
                warning = Some("Playback uses a cached codec-core downmix because the Atmos/JOC render was unavailable on the first preparation.".to_owned());
            }
            (
                "FFmpeg codec-core fallback".to_owned(),
                "channel-downmix".to_owned(),
                object_count,
            )
        } else {
            (
                "OpenJOC 0.7.0 · 2.0 speaker render".to_owned(),
                "openjoc-atmos".to_owned(),
                object_count,
            )
        }
    } else {
        if !was_cached {
            render_with_ffmpeg(path, &playback_path)?;
        }
        (
            "FFmpeg · 48 kHz stereo preparation".to_owned(),
            "local-audio".to_owned(),
            None,
        )
    };

    Ok(PreparedSource {
        playback_path: playback_path.to_string_lossy().into_owned(),
        timeline_path: None,
        probe,
        engine,
        source_kind,
        object_count,
        cached: was_cached,
        warning,
    })
}

#[tauri::command]
async fn probe_media(path: String) -> Result<MediaProbe, String> {
    tauri::async_runtime::spawn_blocking(move || probe_any_path(Path::new(&path)))
        .await
        .map_err(|error| format!("Media probe task failed: {error}"))?
}

#[tauri::command]
async fn prepare_local_source(
    app: tauri::AppHandle,
    path: String,
) -> Result<PreparedSource, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_source(&app, Path::new(&path)))
        .await
        .map_err(|error| format!("Media preparation task failed: {error}"))?
}

#[tauri::command]
async fn render_damf_variant(
    app: tauri::AppHandle,
    path: String,
    solo_id: Option<u32>,
    muted_ids: Vec<u32>,
) -> Result<String, String> {
    DAMF_RENDER_CANCELLED.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        let cache_root = prepared_cache_root(&app, &path)?;
        damf::render_variant(
            &path,
            &cache_root,
            solo_id,
            &muted_ids,
            &DAMF_RENDER_CANCELLED,
        )
        .map(|output| output.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| format!("DAMF re-render task failed: {error}"))?
}

#[tauri::command]
fn cancel_damf_render() {
    DAMF_RENDER_CANCELLED.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn read_local_text(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        if !path.is_file() {
            return Err("The selected timeline file does not exist.".to_owned());
        }
        fs::read_to_string(path)
            .map_err(|error| format!("The selected timeline could not be read: {error}"))
    })
    .await
    .map_err(|error| format!("Timeline read task failed: {error}"))?
}

#[tauri::command]
async fn export_wav(playback_path: String, destination_path: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(playback_path);
        let destination = PathBuf::from(destination_path);
        if !source.is_file() {
            return Err("The prepared monitor render no longer exists.".to_owned());
        }
        if !source
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
        {
            return Err("Only prepared WAV monitor renders can be exported.".to_owned());
        }
        if !destination
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
        {
            return Err("The export destination must use the .wav extension.".to_owned());
        }
        let source = source
            .canonicalize()
            .map_err(|error| format!("Could not resolve the prepared monitor render: {error}"))?;
        if destination.exists() {
            let existing = destination
                .canonicalize()
                .map_err(|error| format!("Could not resolve the export destination: {error}"))?;
            if existing == source {
                return Err("Choose a different destination from the source render.".to_owned());
            }
        }
        fs::copy(&source, &destination)
            .map_err(|error| format!("Could not export the WAV monitor render: {error}"))
    })
    .await
    .map_err(|error| format!("WAV export task failed: {error}"))?
}

#[tauri::command]
async fn export_eac3_bitstream(
    source_path: String,
    destination_path: String,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(source_path);
        let probe = probe_path(&source)?;
        if !probe.codec_name.eq_ignore_ascii_case("eac3") {
            return Err("The selected source does not contain an E-AC-3 audio stream.".to_owned());
        }
        let destination =
            validate_export_destination(&source, Path::new(&destination_path), &["ec3", "eac3"])?;
        let partial = export_partial_path(&destination)?;
        if partial.is_file() {
            fs::remove_file(&partial).map_err(|error| {
                format!("Could not replace an incomplete bitstream export: {error}")
            })?;
        }

        let output = hidden_command(bundled_tool_or_path("ffmpeg"))
            .args(["-v", "error", "-y", "-i"])
            .arg(&source)
            .args(["-map", "0:a:0", "-c:a", "copy", "-f", "eac3"])
            .arg(&partial)
            .output()
            .map_err(|error| {
                format!("ffmpeg could not be started for E-AC-3 extraction: {error}")
            })?;
        if !output.status.success() {
            let _ = fs::remove_file(&partial);
            return Err(command_error("E-AC-3 bitstream extraction", &output));
        }
        promote_export(&partial, &destination, "E-AC-3 bitstream extraction")
    })
    .await
    .map_err(|error| format!("E-AC-3 export task failed: {error}"))?
}

#[tauri::command]
async fn export_oamd_diagnostics(
    app: tauri::AppHandle,
    source_path: String,
    destination_path: String,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(source_path);
        let probe = probe_path(&source)?;
        if !probe.atmos {
            return Err(
                "OAMD diagnostics require a positively identified E-AC-3 JOC source.".to_owned(),
            );
        }
        let destination =
            validate_export_destination(&source, Path::new(&destination_path), &["json"])?;
        let partial = export_partial_path(&destination)?;
        if partial.is_file() {
            fs::remove_file(&partial).map_err(|error| {
                format!("Could not replace incomplete OAMD diagnostics: {error}")
            })?;
        }
        let renderer = locate_openjoc(&app)?;
        let output = hidden_command(renderer)
            .arg("diagnose-oamd")
            .arg(&source)
            .arg("--all-access-units")
            .arg("--json")
            .arg(&partial)
            .arg("--force")
            .output()
            .map_err(|error| {
                format!("OpenJOC could not be started for OAMD diagnostics: {error}")
            })?;
        if !output.status.success() {
            let _ = fs::remove_file(&partial);
            return Err(command_error("OpenJOC OAMD diagnostics", &output));
        }
        let report = File::open(&partial)
            .map_err(|error| format!("Could not read the generated OAMD diagnostics: {error}"))?;
        let mut deserializer = serde_json::Deserializer::from_reader(BufReader::new(report));
        IgnoredAny::deserialize(&mut deserializer)
            .map_err(|error| format!("OpenJOC generated invalid diagnostic JSON: {error}"))?;
        deserializer
            .end()
            .map_err(|error| format!("OpenJOC generated trailing invalid JSON data: {error}"))?;
        promote_export(&partial, &destination, "OpenJOC OAMD diagnostics")
    })
    .await
    .map_err(|error| format!("OAMD diagnostic export task failed: {error}"))?
}

#[tauri::command]
async fn export_atmos_speaker_wav(
    app: tauri::AppHandle,
    source_path: String,
    destination_path: String,
    layout: String,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        speaker_labels(&layout)?;
        let source = PathBuf::from(source_path);
        let probe = probe_path(&source)?;
        if !probe.atmos {
            return Err(
                "Speaker rendering requires a positively identified E-AC-3 JOC source.".to_owned(),
            );
        }
        let destination =
            validate_export_destination(&source, Path::new(&destination_path), &["wav"])?;
        let file_stem = destination
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("speaker-render");
        let partial = destination.with_file_name(format!(".{file_stem}.partial.wav"));
        if partial.is_file() {
            fs::remove_file(&partial).map_err(|error| {
                format!("Could not replace an incomplete speaker render: {error}")
            })?;
        }
        let renderer = locate_openjoc(&app)?;
        let render_result = render_with_openjoc(&renderer, &source, &partial, &layout);
        let _ = fs::remove_file(partial.with_extension("openjoc.log"));
        if let Err(error) = render_result {
            let _ = fs::remove_file(&partial);
            return Err(error);
        }
        promote_export(&partial, &destination, "Atmos speaker render")
    })
    .await
    .map_err(|error| format!("Atmos speaker render task failed: {error}"))?
}

#[tauri::command]
async fn export_atmos_speaker_channels(
    app: tauri::AppHandle,
    source_path: String,
    destination_dir: String,
    layout: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let labels = speaker_labels(&layout)?;
        let source = PathBuf::from(source_path);
        let probe = probe_path(&source)?;
        if !probe.atmos {
            return Err(
                "Speaker-channel rendering requires a positively identified E-AC-3 JOC source."
                    .to_owned(),
            );
        }
        let destination_dir = PathBuf::from(destination_dir)
            .canonicalize()
            .map_err(|error| {
                format!("Could not resolve the speaker-channel export folder: {error}")
            })?;
        if !destination_dir.is_dir() {
            return Err("The speaker-channel export destination is not a directory.".to_owned());
        }
        let cache_dir = prepared_cache_root(&app, &source)?.join("speaker-exports");
        fs::create_dir_all(&cache_dir)
            .map_err(|error| format!("Could not create the speaker render cache: {error}"))?;
        let rendered = cache_dir.join(format!("render-{layout}.wav"));
        let renderer = locate_openjoc(&app)?;
        render_with_openjoc(&renderer, &source, &rendered, &layout)?;

        let source_stem = source
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("atmos-render");
        let mut exported = Vec::with_capacity(labels.len());
        for (index, label) in labels.iter().enumerate() {
            let destination = destination_dir.join(format!("{source_stem}-{layout}-{label}.wav"));
            let partial =
                destination_dir.join(format!(".{source_stem}-{layout}-{label}.partial.wav"));
            if partial.is_file() {
                fs::remove_file(&partial).map_err(|error| {
                    format!("Could not replace an incomplete {label} channel export: {error}")
                })?;
            }
            let pan = format!("pan=mono|c0=c{index}");
            let output = hidden_command(bundled_tool_or_path("ffmpeg"))
                .args(["-v", "error", "-y", "-i"])
                .arg(&rendered)
                .args(["-map", "0:a:0", "-af", &pan, "-c:a", "pcm_f32le"])
                .arg(&partial)
                .output()
                .map_err(|error| format!("ffmpeg could not export the {label} channel: {error}"))?;
            if !output.status.success() {
                let _ = fs::remove_file(&partial);
                return Err(command_error(&format!("{label} channel export"), &output));
            }
            promote_export(&partial, &destination, &format!("{label} channel export"))?;
            exported.push(destination.to_string_lossy().into_owned());
        }
        Ok(exported)
    })
    .await
    .map_err(|error| format!("Atmos speaker-channel export task failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            probe_media,
            prepare_local_source,
            render_damf_variant,
            cancel_damf_render,
            read_local_text,
            export_wav,
            export_eac3_bitstream,
            export_oamd_diagnostics,
            export_atmos_speaker_wav,
            export_atmos_speaker_channels
        ])
        .run(tauri::generate_context!())
        .expect("error while running Immersive Audio Renderer");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("dolby_atmos_chat_export")
            .join("attachments")
            .join(name)
    }

    #[test]
    fn probes_supplied_broadcast_wave() {
        let probe = probe_path(&fixture("atmos-3.wav")).expect("WAV probe should succeed");
        assert_eq!(probe.codec_name, "pcm_s24le");
        assert_eq!(probe.sample_rate, 48_000);
        assert_eq!(probe.channels, 2);
        assert!(!probe.atmos);
    }

    #[test]
    fn detects_supplied_eac3_atmos_master() {
        let probe =
            probe_path(&fixture("01. Helium Balloon.m4a")).expect("M4A probe should succeed");
        assert_eq!(probe.codec_name, "eac3");
        assert_eq!(probe.sample_rate, 48_000);
        assert!(probe.atmos);
    }

    #[test]
    fn validates_delivery_export_extensions() {
        let source = fixture("01. Helium Balloon.m4a");
        let directory = source.parent().expect("fixture directory");
        assert!(validate_export_destination(
            &source,
            &directory.join("delivery.eac3"),
            &["ec3", "eac3"]
        )
        .is_ok());
        assert!(validate_export_destination(
            &source,
            &directory.join("diagnostics.json"),
            &["json"]
        )
        .is_ok());
        assert!(validate_export_destination(
            &source,
            &directory.join("delivery.wav"),
            &["ec3", "eac3"]
        )
        .is_err());
    }

    #[test]
    fn exposes_supported_speaker_channel_orders() {
        assert_eq!(speaker_labels("2.0").unwrap(), &["L", "R"]);
        assert_eq!(
            speaker_labels("5.1").unwrap(),
            &["L", "R", "C", "LFE", "Ls", "Rs"]
        );
        assert!(speaker_labels("9.1.6").is_err());
    }
}
