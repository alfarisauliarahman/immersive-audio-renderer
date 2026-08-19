# Documentation

This directory contains the durable technical and project decisions for Immersive Audio Renderer.

## Technical reference

- [Architecture](ARCHITECTURE.md) — data flow, adapters, capability model, rendering, caching, and trust boundaries.
- [Format support and boundaries](FORMAT_SUPPORT.md) — what each source can actually provide and what the application must not claim.
- [User guide](USER_GUIDE.md) — opening sources, transport, views, object controls, and export.
- [Troubleshooting](TROUBLESHOOTING.md) — audio, loading, cache, Room View, and performance problems.
- [Performance](PERFORMANCE.md) — expected CPU, GPU, memory, and disk behavior plus profiling guidance.

## Working on the project

- [Development](DEVELOPMENT.md) — prerequisites, commands, layout, coding conventions, and release workflow.
- [Testing](TESTING.md) — automated and manual validation, fixture requirements, and acceptance checks.
- [Local fixtures](LOCAL_FIXTURES.md) — private test-media inventory, provenance, and isolation rules.
- [Roadmap](ROADMAP.md) — prioritized remaining work and explicit non-goals.
- [v0.1.0 release notes](RELEASE_NOTES_V0.1.0.md) — shipped capabilities, verification, installation, and known boundaries.

## Repository policies

- [Contributing](../CONTRIBUTING.md)
- [Code of conduct](../CODE_OF_CONDUCT.md)
- [Support](../SUPPORT.md)
- [Security](../SECURITY.md)
- [Privacy](../PRIVACY.md)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)
- [Changelog](../CHANGELOG.md)
- [Apache-2.0 project license](../LICENSE)

When behavior and documentation disagree, the implementation and verified test results describe the current behavior. Update the relevant document in the same change that intentionally changes a capability or product boundary.
