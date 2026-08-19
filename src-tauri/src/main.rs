#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The release executable embeds the production frontend assets.
    immersive_audio_renderer_lib::run();
}
