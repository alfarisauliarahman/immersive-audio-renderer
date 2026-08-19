# Local Test Fixtures

## Policy

Third-party music, masters, metadata, screenshots, chat exports, and generated caches are not project source. Keep them local, outside Git history, and outside release artifacts unless their license explicitly permits redistribution.

The local Git exclude file contains `local-fixtures/`, so this workstation's fixture directory does not appear as a repository change. That exclusion is intentionally local rather than a promise that every clone has the same rule. Contributors must configure equivalent local isolation before copying fixtures into a clone.

Do not use `git add -f` on fixture directories.

## Dolby Atmos Visualizer fixture set

The current workstation holds a private test copy derived from the public [Dolby Atmos Visualizer Music](https://www.dolby.com/atmos-visualizer-music/) page:

```text
local-fixtures/dolby-atmos-visualizer/
```

Inventory at the time of documentation: 15 files, 294,218,475 bytes.

| Track | Directory | Atmos-labelled site render | Stereo comparison | Timeline |
| --- | --- | --- | --- | --- |
| Hypnotic — Rehma | `rehma/` | `rehma---hypnotic-stereo-mix-v2.wav` | `rehma---hypnotic-stereo-mix-v2.mp3` | `atmos-objects.json` |
| O La — Bokanté | `bokante/` | `atmos-2.wav` | `stereo-3.mp3` | `atmos-objects.json` |
| Hot — The Pushers | `hot/` | `atmos-3.wav` | `stereo-4.mp3` | `atmos-objects1.json` |
| Untie — Ultra\\Violet | `untie/` | `atmos-8.wav` | `stereo-10.mp3` | `atmos-objects6.json` |
| Never Satisfied — Theory Hazit feat. Jon Belz | `never-satisfied/` | `atmos-6.wav` | `stereo-8.mp3` | `atmos-objects4.json` |

All five WAV files are 48 kHz, two-channel PCM monitor renders. The MP3 files are stereo comparisons. The JSON files contain visualization timelines with between 24 and 64 elements. None of these files is a `.atmos` master or independently addressable object-stem set.

The files retain the rights and restrictions of Dolby and/or the relevant music rightsholders. This repository's Apache-2.0 license grants no rights to them. Dolby's [Terms of Use](https://www.dolby.com/about/legal/terms-of-use/) restrict copying and redistribution of site content and allow downloads only under the conditions stated there. Keep these copies private and remove them if continued local use is not authorized in your jurisdiction or situation.

## Existing private development area

`dolby_atmos_chat_export/` contains research conversation context and attachments supplied during development. The chat Markdown and screenshots are ignored, but some media entered the initial private Git commit. Before the repository is made public, remove every non-redistributable attachment from the entire Git history rather than deleting it only in a later commit.

The directory can include:

- finished stereo visualizer media and JSON;
- an E-AC-3 JOC M4A sample;
- screenshots;
- a private chat export;
- unrelated or untrusted archives.

Do not execute installers or archives found in fixture/context folders. They are not project dependencies.

## Authorized DAMF fixtures

Large DAMF fixtures should live outside the repository or under `local-fixtures/`. Keep the `.atmos` manifest and its three companions together. Use `DAMF_TEST_PATH` and optionally `DAMF_TEST_CACHE` for the ignored integration test.

Never publish a commercial master solely because it is useful for a test. Record provenance and redistribution terms separately for every candidate public fixture.

## Verification commands

Inspect audio without modifying it:

```powershell
ffprobe -v error -show_streams -show_format 'path\to\fixture.wav'
```

Validate a JSON file in PowerShell:

```powershell
Get-Content -Raw 'path\to\timeline.json' | ConvertFrom-Json | Out-Null
```

Confirm nothing below the local fixture directory is tracked:

```powershell
git ls-files 'local-fixtures/**'
```

The last command must print nothing.
