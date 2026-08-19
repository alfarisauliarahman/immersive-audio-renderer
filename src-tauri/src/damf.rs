use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

const ANALYSIS_FREQUENCY: f64 = 0.1;

#[derive(Debug, Deserialize)]
struct Manifest {
    presentations: Vec<Presentation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Presentation {
    metadata: String,
    audio: String,
    #[serde(default)]
    bed_instances: Vec<BedInstance>,
    #[serde(default)]
    objects: Vec<ObjectRef>,
}

#[derive(Debug, Deserialize)]
struct BedInstance {
    #[serde(default)]
    channels: Vec<ChannelRef>,
}

#[derive(Debug, Deserialize)]
struct ChannelRef {
    channel: String,
    #[serde(rename = "ID")]
    id: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObjectRef {
    #[serde(rename = "ID")]
    id: u32,
    #[serde(default)]
    group_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    sample_rate: Option<u32>,
    #[serde(default)]
    events: Vec<Event>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Event {
    #[serde(rename = "ID")]
    id: Option<u32>,
    sample_pos: Option<u64>,
    active: Option<bool>,
    pos: Option<[f32; 3]>,
    gain: Option<f32>,
}

#[derive(Debug, Clone)]
struct ResolvedEvent {
    id: u32,
    sample_pos: u64,
    active: Option<bool>,
    pos: Option<[f32; 3]>,
    gain: Option<f32>,
}

#[derive(Clone, Copy)]
struct ElementState {
    active: bool,
    pos: [f32; 3],
    gain: f32,
    left: f32,
    right: f32,
}

impl Default for ElementState {
    fn default() -> Self {
        Self {
            active: false,
            pos: [0.0, 1.0, 0.0],
            gain: 1.0,
            left: 0.0,
            right: 0.0,
        }
    }
}

impl ElementState {
    fn refresh_pan(&mut self) {
        if !self.active {
            self.left = 0.0;
            self.right = 0.0;
            return;
        }
        let pan = ((self.pos[0].clamp(-1.0, 1.0) + 1.0) * 0.5) * std::f32::consts::FRAC_PI_2;
        self.left = pan.cos() * self.gain;
        self.right = pan.sin() * self.gain;
    }

    fn apply(&mut self, event: &ResolvedEvent) {
        if let Some(active) = event.active {
            self.active = active;
        }
        if let Some(pos) = event.pos {
            self.pos = pos;
        }
        if let Some(gain_db) = event.gain {
            self.gain = 10.0_f32.powf(gain_db / 20.0);
        }
        self.refresh_pan();
    }
}

#[derive(Debug)]
struct CafInfo {
    sample_rate: u32,
    channels: usize,
    bits_per_channel: usize,
    bytes_per_packet: usize,
    frames_per_packet: usize,
    format_flags: u32,
    data_offset: u64,
    data_bytes: u64,
}

impl CafInfo {
    fn frames(&self) -> u64 {
        self.data_bytes / self.bytes_per_packet.max(1) as u64
    }
}

#[derive(Debug, Clone)]
pub struct DamfInfo {
    pub file_name: String,
    pub sample_rate: u32,
    pub channels: u32,
    pub duration: f64,
    pub object_count: u32,
}

#[derive(Debug)]
pub struct PreparedDamf {
    pub playback_path: PathBuf,
    pub timeline_path: PathBuf,
    pub info: DamfInfo,
    pub cached: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TimelineObject {
    id: u32,
    input_id: u32,
    group_name: String,
    positions: Vec<f32>,
    loudness: Vec<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Capabilities {
    object_positions: bool,
    object_levels: bool,
    object_audio: bool,
    object_solo: bool,
    object_mute: bool,
    rerender: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Timeline {
    name: String,
    source_label: String,
    duration: f64,
    sample_rate: u32,
    frequency: f64,
    objects: Vec<TimelineObject>,
    overall_loudness: Vec<f32>,
    loudest_id: Vec<i32>,
    integrated_power: Vec<f64>,
    capabilities: Capabilities,
}

struct Analysis {
    object_loudness: Vec<Vec<f32>>,
    overall_loudness: Vec<f32>,
}

struct DamfSource {
    manifest_path: PathBuf,
    audio_path: PathBuf,
    presentation: Presentation,
    events: Vec<ResolvedEvent>,
    caf: CafInfo,
}

fn read_be_u32(reader: &mut impl Read) -> Result<u32, String> {
    let mut bytes = [0; 4];
    reader
        .read_exact(&mut bytes)
        .map_err(|error| format!("Could not read the CAF header: {error}"))?;
    Ok(u32::from_be_bytes(bytes))
}

fn read_be_i64(reader: &mut impl Read) -> Result<i64, String> {
    let mut bytes = [0; 8];
    reader
        .read_exact(&mut bytes)
        .map_err(|error| format!("Could not read the CAF header: {error}"))?;
    Ok(i64::from_be_bytes(bytes))
}

fn read_be_f64(reader: &mut impl Read) -> Result<f64, String> {
    let mut bytes = [0; 8];
    reader
        .read_exact(&mut bytes)
        .map_err(|error| format!("Could not read the CAF header: {error}"))?;
    Ok(f64::from_be_bytes(bytes))
}

fn read_caf_info(path: &Path) -> Result<CafInfo, String> {
    let mut reader = BufReader::new(
        File::open(path).map_err(|error| format!("Could not open DAMF audio: {error}"))?,
    );
    let mut magic = [0; 4];
    reader
        .read_exact(&mut magic)
        .map_err(|error| format!("Could not read DAMF audio: {error}"))?;
    if &magic != b"caff" {
        return Err("The DAMF audio companion is not an Apple CAF file.".to_owned());
    }
    reader
        .seek(SeekFrom::Current(4))
        .map_err(|error| format!("Could not seek DAMF audio: {error}"))?;

    let mut desc: Option<CafInfo> = None;
    loop {
        let mut chunk_type = [0; 4];
        if reader.read_exact(&mut chunk_type).is_err() {
            break;
        }
        let chunk_size = read_be_i64(&mut reader)?;
        match &chunk_type {
            b"desc" => {
                let sample_rate = read_be_f64(&mut reader)? as u32;
                let mut format_id = [0; 4];
                reader
                    .read_exact(&mut format_id)
                    .map_err(|error| format!("Could not read CAF format: {error}"))?;
                if &format_id != b"lpcm" {
                    return Err("Only linear PCM DAMF audio is currently supported.".to_owned());
                }
                let format_flags = read_be_u32(&mut reader)?;
                let bytes_per_packet = read_be_u32(&mut reader)? as usize;
                let frames_per_packet = read_be_u32(&mut reader)? as usize;
                let channels = read_be_u32(&mut reader)? as usize;
                let bits_per_channel = read_be_u32(&mut reader)? as usize;
                desc = Some(CafInfo {
                    sample_rate,
                    channels,
                    bits_per_channel,
                    bytes_per_packet,
                    frames_per_packet,
                    format_flags,
                    data_offset: 0,
                    data_bytes: 0,
                });
                if chunk_size > 32 {
                    reader
                        .seek(SeekFrom::Current(chunk_size - 32))
                        .map_err(|error| format!("Could not seek CAF description: {error}"))?;
                }
            }
            b"data" => {
                let _edit_count = read_be_u32(&mut reader)?;
                let data_offset = reader
                    .stream_position()
                    .map_err(|error| format!("Could not locate CAF audio data: {error}"))?;
                let data_bytes = if chunk_size < 0 {
                    let end = reader
                        .seek(SeekFrom::End(0))
                        .map_err(|error| format!("Could not size CAF audio data: {error}"))?;
                    end.saturating_sub(data_offset)
                } else {
                    (chunk_size as u64).saturating_sub(4)
                };
                let info = desc
                    .as_mut()
                    .ok_or_else(|| "CAF data appeared before its format description.".to_owned())?;
                info.data_offset = data_offset;
                info.data_bytes = data_bytes;
                break;
            }
            _ => {
                if chunk_size < 0 {
                    return Err("DAMF audio contains an invalid CAF chunk size.".to_owned());
                }
                reader
                    .seek(SeekFrom::Current(chunk_size))
                    .map_err(|error| format!("Could not skip CAF chunk: {error}"))?;
            }
        }
    }

    let info = desc.ok_or_else(|| "DAMF audio has no CAF description chunk.".to_owned())?;
    if info.data_offset == 0 {
        return Err("DAMF audio has no CAF data chunk.".to_owned());
    }
    if info.bits_per_channel != 24 || info.frames_per_packet != 1 {
        return Err(format!(
            "This DAMF uses unsupported PCM packing ({}-bit, {} frames/packet).",
            info.bits_per_channel, info.frames_per_packet
        ));
    }
    if info.format_flags & 0x1 != 0 || info.format_flags & 0x2 == 0 {
        return Err("This DAMF does not use supported little-endian integer PCM.".to_owned());
    }
    if info.bytes_per_packet != info.channels * 3 {
        return Err("The DAMF CAF packet size does not match its channel count.".to_owned());
    }
    Ok(info)
}

fn safe_companion(manifest: &Path, relative: &str) -> Result<PathBuf, String> {
    let parent = manifest
        .parent()
        .ok_or_else(|| "The DAMF manifest has no parent folder.".to_owned())?
        .canonicalize()
        .map_err(|error| format!("Could not resolve the DAMF folder: {error}"))?;
    let candidate = parent
        .join(relative)
        .canonicalize()
        .map_err(|error| format!("Missing DAMF companion '{relative}': {error}"))?;
    if !candidate.starts_with(&parent) || !candidate.is_file() {
        return Err(format!("Unsafe or missing DAMF companion: {relative}"));
    }
    Ok(candidate)
}

fn resolve_events(events: &[Event]) -> Result<Vec<ResolvedEvent>, String> {
    let mut current_id = None;
    let mut current_sample = 0;
    let mut resolved = Vec::with_capacity(events.len());
    for event in events {
        if let Some(id) = event.id {
            current_id = Some(id);
        }
        if let Some(sample_pos) = event.sample_pos {
            current_sample = sample_pos;
        }
        resolved.push(ResolvedEvent {
            id: current_id.ok_or_else(|| {
                "DAMF metadata begins with an event that has no element ID.".to_owned()
            })?,
            sample_pos: current_sample,
            active: event.active,
            pos: event.pos,
            gain: event.gain,
        });
    }
    resolved.sort_by_key(|event| event.sample_pos);
    Ok(resolved)
}

fn load_source(path: &Path) -> Result<DamfSource, String> {
    let manifest_text = fs::read_to_string(path)
        .map_err(|error| format!("Could not read the DAMF manifest: {error}"))?;
    let manifest: Manifest = serde_yaml_ng::from_str(&manifest_text)
        .map_err(|error| format!("Could not parse the DAMF manifest: {error}"))?;
    let presentation = manifest
        .presentations
        .into_iter()
        .next()
        .ok_or_else(|| "The DAMF manifest contains no presentation.".to_owned())?;
    let audio_path = safe_companion(path, &presentation.audio)?;
    let metadata_path = safe_companion(path, &presentation.metadata)?;
    let metadata_text = fs::read_to_string(&metadata_path)
        .map_err(|error| format!("Could not read DAMF object metadata: {error}"))?;
    let metadata: Metadata = serde_yaml_ng::from_str(&metadata_text)
        .map_err(|error| format!("Could not parse DAMF object metadata: {error}"))?;
    let events = resolve_events(&metadata.events)?;
    let caf = read_caf_info(&audio_path)?;
    if let Some(sample_rate) = metadata.sample_rate {
        if sample_rate != caf.sample_rate {
            return Err("DAMF audio and metadata sample rates do not match.".to_owned());
        }
    }
    for object in &presentation.objects {
        if object.id as usize >= caf.channels {
            return Err(format!(
                "DAMF object {} points outside the {}-channel audio essence.",
                object.id, caf.channels
            ));
        }
    }
    Ok(DamfSource {
        manifest_path: path.to_owned(),
        audio_path,
        presentation,
        events,
        caf,
    })
}

pub fn inspect(path: &Path) -> Result<DamfInfo, String> {
    let source = load_source(path)?;
    Ok(DamfInfo {
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Dolby Atmos master")
            .to_owned(),
        sample_rate: source.caf.sample_rate,
        channels: source.caf.channels as u32,
        duration: source.caf.frames() as f64 / source.caf.sample_rate as f64,
        object_count: source.presentation.objects.len() as u32,
    })
}

fn bed_gain(name: &str) -> (f32, f32) {
    let normalized = name.to_ascii_lowercase();
    if normalized == "l" {
        (1.0, 0.0)
    } else if normalized == "r" {
        (0.0, 1.0)
    } else if normalized == "c" {
        (0.707, 0.707)
    } else if normalized == "lfe" {
        (0.35, 0.35)
    } else if normalized.starts_with('l') {
        (0.707, 0.0)
    } else if normalized.starts_with('r') {
        (0.0, 0.707)
    } else {
        (0.5, 0.5)
    }
}

fn decode_s24le(bytes: &[u8]) -> f32 {
    let packed = (bytes[0] as i32) | ((bytes[1] as i32) << 8) | ((bytes[2] as i32) << 16);
    let signed = if packed & 0x0080_0000 != 0 {
        packed | !0x00ff_ffff
    } else {
        packed
    };
    signed as f32 / 8_388_608.0
}

fn decode_f32le(bytes: &[u8]) -> f32 {
    f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

fn remove_from_soft_limited_mix(full_sample: f32, contribution: f32, global_gain: f32) -> f32 {
    (full_sample.clamp(-0.999_999, 0.999_999).atanh() - contribution * global_gain).tanh()
}

fn write_float_wav_header(
    writer: &mut impl Write,
    sample_rate: u32,
    frames: u64,
) -> Result<(), String> {
    let data_size = frames
        .checked_mul(8)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| "The stereo DAMF render exceeds the WAV size limit.".to_owned())?;
    writer
        .write_all(b"RIFF")
        .and_then(|_| writer.write_all(&(36 + data_size).to_le_bytes()))
        .and_then(|_| writer.write_all(b"WAVEfmt "))
        .and_then(|_| writer.write_all(&16_u32.to_le_bytes()))
        .and_then(|_| writer.write_all(&3_u16.to_le_bytes()))
        .and_then(|_| writer.write_all(&2_u16.to_le_bytes()))
        .and_then(|_| writer.write_all(&sample_rate.to_le_bytes()))
        .and_then(|_| writer.write_all(&(sample_rate * 8).to_le_bytes()))
        .and_then(|_| writer.write_all(&8_u16.to_le_bytes()))
        .and_then(|_| writer.write_all(&32_u16.to_le_bytes()))
        .and_then(|_| writer.write_all(b"data"))
        .and_then(|_| writer.write_all(&data_size.to_le_bytes()))
        .map_err(|error| format!("Could not write the DAMF render header: {error}"))
}

fn render(
    source: &DamfSource,
    output_path: &Path,
    solo_id: Option<u32>,
    muted_ids: &HashSet<u32>,
    analyze: bool,
    cancel: Option<&AtomicBool>,
) -> Result<Option<Analysis>, String> {
    let frames = source.caf.frames();
    let sample_rate = source.caf.sample_rate;
    let analysis_samples = (sample_rate as f64 * ANALYSIS_FREQUENCY).round() as u64;
    let analysis_frames = (frames.div_ceil(analysis_samples)) as usize;
    let object_count = source.presentation.objects.len();
    let mut object_energy = analyze.then(|| vec![vec![0.0_f64; analysis_frames]; object_count]);
    let mut overall_energy = analyze.then(|| vec![0.0_f64; analysis_frames]);
    let mut analysis_counts = analyze.then(|| vec![0_u64; analysis_frames]);

    let mut states = vec![ElementState::default(); source.caf.channels];
    let mut bed_gains = vec![(0.0_f32, 0.0_f32); source.caf.channels];
    for bed in &source.presentation.bed_instances {
        for channel in &bed.channels {
            if let Some(slot) = bed_gains.get_mut(channel.id as usize) {
                *slot = bed_gain(&channel.channel);
            }
        }
    }
    let mut object_index = vec![None; source.caf.channels];
    for (index, object) in source.presentation.objects.iter().enumerate() {
        object_index[object.id as usize] = Some(index);
    }

    let mut reader = BufReader::with_capacity(
        1024 * 1024,
        File::open(&source.audio_path)
            .map_err(|error| format!("Could not open DAMF audio for rendering: {error}"))?,
    );
    reader
        .seek(SeekFrom::Start(source.caf.data_offset))
        .map_err(|error| format!("Could not seek to DAMF audio samples: {error}"))?;
    let partial_path = output_path.with_extension("wav.partial");
    if partial_path.is_file() {
        fs::remove_file(&partial_path)
            .map_err(|error| format!("Could not replace an incomplete DAMF render: {error}"))?;
    }
    let mut writer = BufWriter::with_capacity(
        1024 * 1024,
        File::create(&partial_path)
            .map_err(|error| format!("Could not create the DAMF render: {error}"))?,
    );
    write_float_wav_header(&mut writer, sample_rate, frames)?;

    let frame_bytes = source.caf.bytes_per_packet;
    let block_frames = 1024_usize;
    let mut input = vec![0_u8; block_frames * frame_bytes];
    let mut output = Vec::with_capacity(block_frames * 8);
    let mut event_index = 0_usize;
    let mut sample_pos = 0_u64;
    let global_gain = 0.25_f32;
    let solo_channel = solo_id.map(|id| id as usize);

    while sample_pos < frames {
        if cancel.is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            drop(writer);
            let _ = fs::remove_file(&partial_path);
            return Err("DAMF render cancelled.".to_owned());
        }
        let count = ((frames - sample_pos) as usize).min(block_frames);
        let input_bytes = count * frame_bytes;
        reader
            .read_exact(&mut input[..input_bytes])
            .map_err(|error| format!("Could not read DAMF PCM samples: {error}"))?;
        output.clear();

        for local_frame in 0..count {
            let absolute_sample = sample_pos + local_frame as u64;
            while let Some(event) = source.events.get(event_index) {
                if event.sample_pos > absolute_sample {
                    break;
                }
                if let Some(state) = states.get_mut(event.id as usize) {
                    state.apply(event);
                }
                event_index += 1;
            }

            let analysis_index = (absolute_sample / analysis_samples) as usize;
            if let Some(counts) = analysis_counts.as_mut() {
                counts[analysis_index] += 1;
            }
            let frame_start = local_frame * frame_bytes;
            let mut left = 0.0_f32;
            let mut right = 0.0_f32;
            if let Some(channel) = solo_channel {
                // A DAMF CAF is interleaved, so the block still has to be read,
                // but a solo render only decodes and mixes its one authored
                // channel instead of doing work for every channel in the master.
                let offset = frame_start + channel * 3;
                let sample = decode_s24le(&input[offset..offset + 3]);
                let state = states[channel];
                if state.active && !muted_ids.contains(&(channel as u32)) {
                    left = sample * state.left;
                    right = sample * state.right;
                }
            } else {
                for channel in 0..source.caf.channels {
                    let offset = frame_start + channel * 3;
                    let sample = decode_s24le(&input[offset..offset + 3]);
                    if let Some(index) = object_index[channel] {
                        let id = source.presentation.objects[index].id;
                        let state = states[channel];
                        let object_sample = if state.active {
                            sample * state.gain
                        } else {
                            0.0
                        };
                        if let Some(energies) = object_energy.as_mut() {
                            energies[index][analysis_index] +=
                                (object_sample as f64) * (object_sample as f64);
                        }
                        if !muted_ids.contains(&id) {
                            left += sample * state.left;
                            right += sample * state.right;
                        }
                    } else {
                        let (left_gain, right_gain) = bed_gains[channel];
                        left += sample * left_gain;
                        right += sample * right_gain;
                    }
                }
            }
            let left_out = (left * global_gain).tanh();
            let right_out = (right * global_gain).tanh();
            if let Some(energies) = overall_energy.as_mut() {
                energies[analysis_index] +=
                    ((left_out as f64).powi(2) + (right_out as f64).powi(2)) * 0.5;
            }
            output.extend_from_slice(&left_out.to_le_bytes());
            output.extend_from_slice(&right_out.to_le_bytes());
        }
        writer
            .write_all(&output)
            .map_err(|error| format!("Could not write DAMF render samples: {error}"))?;
        sample_pos += count as u64;
    }
    writer
        .flush()
        .map_err(|error| format!("Could not finish the DAMF render: {error}"))?;
    drop(writer);
    fs::rename(&partial_path, output_path)
        .map_err(|error| format!("Could not finalize the DAMF render: {error}"))?;

    match (object_energy, overall_energy, analysis_counts) {
        (Some(object_energy), Some(overall_energy), Some(counts)) => {
            let to_db = |energy: f64, count: u64| {
                if energy > 0.0 && count > 0 {
                    (10.0 * (energy / count as f64).log10()).max(-100.0) as f32
                } else {
                    -100.0
                }
            };
            Ok(Some(Analysis {
                object_loudness: object_energy
                    .into_iter()
                    .map(|frames| {
                        frames
                            .into_iter()
                            .zip(&counts)
                            .map(|(energy, count)| to_db(energy, *count))
                            .collect()
                    })
                    .collect(),
                overall_loudness: overall_energy
                    .into_iter()
                    .zip(&counts)
                    .map(|(energy, count)| to_db(energy, *count))
                    .collect(),
            }))
        }
        _ => Ok(None),
    }
}

fn render_muted_from_full(
    source: &DamfSource,
    full_path: &Path,
    output_path: &Path,
    muted_ids: &HashSet<u32>,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let frames = source.caf.frames();
    let sample_rate = source.caf.sample_rate;
    let mut states = vec![ElementState::default(); source.caf.channels];
    let muted_channels = muted_ids.iter().map(|id| *id as usize).collect::<Vec<_>>();

    let mut source_reader = BufReader::with_capacity(
        1024 * 1024,
        File::open(&source.audio_path)
            .map_err(|error| format!("Could not open DAMF audio for mute rendering: {error}"))?,
    );
    source_reader
        .seek(SeekFrom::Start(source.caf.data_offset))
        .map_err(|error| format!("Could not seek to DAMF audio samples: {error}"))?;
    let mut full_reader = BufReader::with_capacity(
        1024 * 1024,
        File::open(full_path)
            .map_err(|error| format!("Could not open the cached full DAMF render: {error}"))?,
    );
    full_reader
        .seek(SeekFrom::Start(44))
        .map_err(|error| format!("Could not seek in the cached full DAMF render: {error}"))?;

    let partial_path = output_path.with_extension("wav.partial");
    if partial_path.is_file() {
        fs::remove_file(&partial_path)
            .map_err(|error| format!("Could not replace an incomplete DAMF render: {error}"))?;
    }
    let mut writer = BufWriter::with_capacity(
        1024 * 1024,
        File::create(&partial_path)
            .map_err(|error| format!("Could not create the DAMF mute render: {error}"))?,
    );
    write_float_wav_header(&mut writer, sample_rate, frames)?;

    let frame_bytes = source.caf.bytes_per_packet;
    let block_frames = 1024_usize;
    let mut input = vec![0_u8; block_frames * frame_bytes];
    let mut full_mix = vec![0_u8; block_frames * 8];
    let mut output = Vec::with_capacity(block_frames * 8);
    let mut event_index = 0_usize;
    let mut sample_pos = 0_u64;
    let global_gain = 0.25_f32;

    while sample_pos < frames {
        if cancel.load(Ordering::Relaxed) {
            drop(writer);
            let _ = fs::remove_file(&partial_path);
            return Err("DAMF render cancelled.".to_owned());
        }
        let count = ((frames - sample_pos) as usize).min(block_frames);
        source_reader
            .read_exact(&mut input[..count * frame_bytes])
            .map_err(|error| format!("Could not read DAMF PCM samples: {error}"))?;
        full_reader
            .read_exact(&mut full_mix[..count * 8])
            .map_err(|error| format!("Could not read the cached full DAMF render: {error}"))?;
        output.clear();

        for local_frame in 0..count {
            let absolute_sample = sample_pos + local_frame as u64;
            while let Some(event) = source.events.get(event_index) {
                if event.sample_pos > absolute_sample {
                    break;
                }
                if let Some(state) = states.get_mut(event.id as usize) {
                    state.apply(event);
                }
                event_index += 1;
            }

            let full_offset = local_frame * 8;
            let full_left = decode_f32le(&full_mix[full_offset..full_offset + 4]);
            let full_right = decode_f32le(&full_mix[full_offset + 4..full_offset + 8]);
            let frame_start = local_frame * frame_bytes;
            let mut removed_left = 0.0_f32;
            let mut removed_right = 0.0_f32;
            for channel in &muted_channels {
                let state = states[*channel];
                if !state.active {
                    continue;
                }
                let offset = frame_start + channel * 3;
                let sample = decode_s24le(&input[offset..offset + 3]);
                removed_left += sample * state.left;
                removed_right += sample * state.right;
            }
            output.extend_from_slice(
                &remove_from_soft_limited_mix(full_left, removed_left, global_gain).to_le_bytes(),
            );
            output.extend_from_slice(
                &remove_from_soft_limited_mix(full_right, removed_right, global_gain).to_le_bytes(),
            );
        }
        writer
            .write_all(&output)
            .map_err(|error| format!("Could not write DAMF mute samples: {error}"))?;
        sample_pos += count as u64;
    }
    writer
        .flush()
        .map_err(|error| format!("Could not finish the DAMF mute render: {error}"))?;
    drop(writer);
    fs::rename(&partial_path, output_path)
        .map_err(|error| format!("Could not finalize the DAMF mute render: {error}"))
}

fn build_timeline(source: &DamfSource, analysis: Analysis) -> Timeline {
    let frame_count = analysis.overall_loudness.len();
    let analysis_samples = (source.caf.sample_rate as f64 * ANALYSIS_FREQUENCY).round() as u64;
    let mut states = vec![ElementState::default(); source.caf.channels];
    let mut event_index = 0;
    let mut positions =
        vec![Vec::with_capacity(frame_count * 3); source.presentation.objects.len()];
    for frame in 0..frame_count {
        let sample_pos = frame as u64 * analysis_samples;
        while let Some(event) = source.events.get(event_index) {
            if event.sample_pos > sample_pos {
                break;
            }
            if let Some(state) = states.get_mut(event.id as usize) {
                state.apply(event);
            }
            event_index += 1;
        }
        for (index, object) in source.presentation.objects.iter().enumerate() {
            let pos = states[object.id as usize].pos;
            positions[index].extend_from_slice(&pos);
        }
    }

    let mut loudest_id = Vec::with_capacity(frame_count);
    for frame in 0..frame_count {
        let loudest = analysis
            .object_loudness
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a[frame].total_cmp(&b[frame]))
            .map(|(index, _)| source.presentation.objects[index].id as i32)
            .unwrap_or(-1);
        loudest_id.push(loudest);
    }
    let mut power_sum = 0.0;
    let integrated_power = analysis
        .overall_loudness
        .iter()
        .map(|db| {
            power_sum += 10.0_f64.powf(*db as f64 / 10.0);
            power_sum
        })
        .collect();
    let name = source
        .manifest_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Dolby Atmos master")
        .to_owned();
    let objects = source
        .presentation
        .objects
        .iter()
        .enumerate()
        .map(|(index, object)| TimelineObject {
            id: object.id,
            input_id: object.id + 1,
            group_name: object.group_name.clone(),
            positions: std::mem::take(&mut positions[index]),
            loudness: analysis.object_loudness[index].clone(),
        })
        .collect();

    Timeline {
        name,
        source_label: format!(
            "DAMF MASTER · {} BED CHANNELS · {} AUTHORED OBJECTS · TRUE PCM + POSITION METADATA",
            source
                .presentation
                .bed_instances
                .iter()
                .map(|bed| bed.channels.len())
                .sum::<usize>(),
            source.presentation.objects.len()
        ),
        duration: source.caf.frames() as f64 / source.caf.sample_rate as f64,
        sample_rate: source.caf.sample_rate,
        frequency: ANALYSIS_FREQUENCY,
        objects,
        overall_loudness: analysis.overall_loudness,
        loudest_id,
        integrated_power,
        capabilities: Capabilities {
            object_positions: true,
            object_levels: true,
            object_audio: true,
            object_solo: true,
            object_mute: true,
            rerender: true,
        },
    }
}

pub fn prepare(path: &Path, cache_dir: &Path) -> Result<PreparedDamf, String> {
    let source = load_source(path)?;
    fs::create_dir_all(cache_dir)
        .map_err(|error| format!("Could not create the DAMF cache: {error}"))?;
    let playback_path = cache_dir.join("damf-full.wav");
    let timeline_path = cache_dir.join("damf-scene.json");
    let cached = playback_path.is_file()
        && timeline_path.is_file()
        && fs::metadata(&playback_path)
            .map(|metadata| metadata.len() > 44)
            .unwrap_or(false);
    if !cached {
        let analysis = render(&source, &playback_path, None, &HashSet::new(), true, None)?
            .ok_or_else(|| "DAMF analysis was not generated.".to_owned())?;
        let timeline = build_timeline(&source, analysis);
        let partial = timeline_path.with_extension("json.partial");
        let file = File::create(&partial)
            .map_err(|error| format!("Could not create the DAMF scene cache: {error}"))?;
        serde_json::to_writer(BufWriter::new(file), &timeline)
            .map_err(|error| format!("Could not serialize the DAMF scene: {error}"))?;
        fs::rename(&partial, &timeline_path)
            .map_err(|error| format!("Could not finalize the DAMF scene cache: {error}"))?;
    }
    Ok(PreparedDamf {
        playback_path,
        timeline_path,
        info: DamfInfo {
            file_name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Dolby Atmos master")
                .to_owned(),
            sample_rate: source.caf.sample_rate,
            channels: source.caf.channels as u32,
            duration: source.caf.frames() as f64 / source.caf.sample_rate as f64,
            object_count: source.presentation.objects.len() as u32,
        },
        cached,
    })
}

pub fn render_variant(
    path: &Path,
    cache_dir: &Path,
    solo_id: Option<u32>,
    muted_ids: &[u32],
    cancel: &AtomicBool,
) -> Result<PathBuf, String> {
    let source = load_source(path)?;
    if let Some(id) = solo_id {
        if !source
            .presentation
            .objects
            .iter()
            .any(|object| object.id == id)
        {
            return Err(format!("DAMF object {id} does not exist."));
        }
    }
    let mut normalized_muted = muted_ids.to_vec();
    normalized_muted.sort_unstable();
    normalized_muted.dedup();
    if normalized_muted.iter().any(|id| {
        !source
            .presentation
            .objects
            .iter()
            .any(|object| object.id == *id)
    }) {
        return Err("A muted DAMF object does not exist in this master.".to_owned());
    }
    let file_name = if let Some(id) = solo_id {
        format!("damf-solo-{id}.wav")
    } else if normalized_muted.is_empty() {
        "damf-full.wav".to_owned()
    } else {
        format!(
            "damf-mute-{}.wav",
            normalized_muted
                .iter()
                .map(u32::to_string)
                .collect::<Vec<_>>()
                .join("-")
        )
    };
    let output_path = cache_dir.join(file_name);
    if !output_path.is_file()
        || fs::metadata(&output_path)
            .map(|metadata| metadata.len() <= 44)
            .unwrap_or(true)
    {
        fs::create_dir_all(cache_dir)
            .map_err(|error| format!("Could not create the DAMF cache: {error}"))?;
        let muted = normalized_muted.into_iter().collect::<HashSet<_>>();
        if solo_id.is_none() && !muted.is_empty() {
            let full_path = cache_dir.join("damf-full.wav");
            if full_path.is_file() {
                render_muted_from_full(&source, &full_path, &output_path, &muted, cancel)?;
            } else {
                render(&source, &output_path, None, &muted, false, Some(cancel))?;
            }
        } else {
            render(&source, &output_path, solo_id, &muted, false, Some(cancel))?;
        }
    }
    Ok(output_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_diff_encoded_event_ids() {
        let events = vec![
            Event {
                id: Some(10),
                sample_pos: Some(0),
                active: Some(true),
                pos: Some([0.0, 1.0, 0.0]),
                gain: Some(0.0),
            },
            Event {
                id: None,
                sample_pos: Some(960),
                active: None,
                pos: Some([0.5, 1.0, 0.0]),
                gain: None,
            },
        ];
        let resolved = resolve_events(&events).expect("events should resolve");
        assert_eq!(resolved[1].id, 10);
        assert_eq!(resolved[1].sample_pos, 960);
        assert_eq!(resolved[1].pos, Some([0.5, 1.0, 0.0]));
    }

    #[test]
    fn decodes_signed_24_bit_pcm() {
        assert!((decode_s24le(&[0xff, 0xff, 0x7f]) - 0.999_999_9).abs() < 0.000_001);
        assert_eq!(decode_s24le(&[0x00, 0x00, 0x80]), -1.0);
        assert_eq!(decode_s24le(&[0x00, 0x00, 0x00]), 0.0);
    }

    #[test]
    fn removes_an_object_from_the_cached_soft_limited_mix() {
        let bed = 0.42_f32;
        let object = -0.18_f32;
        let gain = 0.25_f32;
        let full = ((bed + object) * gain).tanh();
        let muted = remove_from_soft_limited_mix(full, object, gain);
        assert!((muted - (bed * gain).tanh()).abs() < 0.000_001);
    }

    #[test]
    #[ignore = "requires an external multi-gigabyte DAMF fixture"]
    fn prepares_external_damf_fixture() {
        let path = std::env::var("DAMF_TEST_PATH").expect("set DAMF_TEST_PATH");
        let cache = std::env::var("DAMF_TEST_CACHE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir().join("immersive-renderer-damf-test"));
        let started = std::time::Instant::now();
        let prepared = prepare(Path::new(&path), &cache).expect("DAMF should prepare");
        eprintln!(
            "prepared {} objects in {:.2?}: {}",
            prepared.info.object_count,
            started.elapsed(),
            prepared.playback_path.display()
        );
        assert!(prepared.playback_path.is_file());
        assert!(prepared.timeline_path.is_file());
        assert!(prepared.info.object_count > 0);
        let first_object = load_source(Path::new(&path))
            .expect("DAMF should reload")
            .presentation
            .objects[0]
            .id;
        let cancel = AtomicBool::new(false);
        let solo = render_variant(Path::new(&path), &cache, Some(first_object), &[], &cancel)
            .expect("object solo should render");
        let muted = render_variant(Path::new(&path), &cache, None, &[first_object], &cancel)
            .expect("object mute should render");
        assert!(solo.is_file());
        assert!(muted.is_file());
    }
}
