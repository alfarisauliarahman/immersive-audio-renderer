# Support

## Before requesting help

Read:

- [User guide](docs/USER_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Format support and boundaries](docs/FORMAT_SUPPORT.md)
- [Known roadmap work](docs/ROADMAP.md)

Confirm you are using the latest portable build or latest `main`, then reproduce the issue with a file you are authorized to use.

## Where to ask

- Use GitHub Issues for reproducible bugs, documentation problems, and focused feature requests.
- Use repository Discussions, when enabled, for general workflow and usage questions.
- Use the private process in [SECURITY.md](SECURITY.md) for vulnerabilities.
- Use the private conduct-reporting path in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community incidents.

This is an independent community project. Dolby product licensing, Dolby Renderer operation, certification, delivery acceptance, and commercial mastering support must be handled through the appropriate official vendor or facility.

## Bug report checklist

Include:

- application version or commit SHA;
- Windows version, CPU/GPU, RAM, and storage type;
- portable executable or development mode;
- source container, codec/profile, sample rate, channel count, duration, and approximate size;
- Source Inspector engine, cache state, and full warning text;
- exact steps, expected result, and observed result;
- whether the issue survives a cold cache and application restart;
- relevant FFmpeg/OpenJOC version information;
- logs with usernames, personal paths, tokens, and commercial titles redacted.

For performance reports, also follow [Performance](docs/PERFORMANCE.md).

## Media attachments

Do not upload commercial songs, private DAMF masters, website-ripped demo media, chat exports, or other files you cannot redistribute. Prefer:

- a small project-generated reproduction;
- an explicitly licensed public fixture;
- ffprobe output;
- a SHA-256 hash and structural description;
- redacted diagnostic JSON when it contains no restricted source material.

Maintainers may close reports that depend on inaccessible or unlawfully redistributed material, but should preserve any independently reproducible technical finding.

## Capability questions

Before reporting disabled controls as a bug, check the source capability matrix. Object solo/mute requires verified independently addressable object PCM. WAV + JSON and M4A E-AC-3 JOC delivery sources do not provide the authored DAMF binding needed for those controls.

## Response expectations

There is no guaranteed response or resolution time. Clear reproductions, lawful fixtures, bounded logs, and tested patches are easier to review. A feature request may be declined when it would misrepresent source capability, create an unsafe file path, or introduce incompatible licensing obligations.
