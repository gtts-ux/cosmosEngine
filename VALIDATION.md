# Version 1.6 validation — 22 October 2026

Development hardware: Intel Mac, macOS 14.8.2; Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Only Intel runtime behavior is tested locally. Installer bundles are built for Intel and Apple Silicon, with ad-hoc signing and no Apple notarization.

The 30 numerical/model checks cover the previous orbital, clock, settings, geographic, terrain, telescope, shape, atmosphere and stellar catalog behavior. Added checks cover deterministic default populations, stable parented moons inside the Hill-sphere limit, preservation of existing recipes, update version/architecture/source selection, streamed checksum verification, corrupt installers, tampering and offline failures.

Desktop suites use isolated profiles and block renderer HTTP/HTTPS. Streaming checks cover automatic populations, browsing without moving, travel with streamed maps/terrain, exoplanet moon landing, additional worlds, texture release on departure, adaptive-resolution settings and restart persistence. The update UI uses an isolated main-process transport fixture; installer opening is stubbed only in that test profile. Production update downloads use the fixed GitHub release endpoint, architecture-specific DMG URLs and release checksums.

The performance script records requestAnimationFrame median/p95/max timings and CPU samples after view warm-up. Baseline and updated results are in ignored test-output reports. These measurements cover specific local views and do not guarantee a minimum FPS on other hardware or during resource uploads.

Limits: all extrasolar planets/moons and terrain are reconstructions. Photo-derived gas templates improve appearance without representing observed exoplanet surfaces. The star catalog omits binary companions and proper motion. Atmospheric interiors are visual approximations; deep-fluid dynamics and exact topography are not simulated. Distant systems retain lightweight shared meshes/data; full detail is streamed near the camera. Updating opens a verified installer and requires replacing the app through the macOS installer window.

Results: all 30 numerical/model/security checks passed. The source app passed all 21 Solar System regression groups and six visual groups. The packaged Intel app passed eight streaming/persistence groups and four update-UI groups, with no shader or streaming errors.

In the packaged balanced-quality benchmark, all four warmed views had median frame times of about 16.7 ms (Earth, Moon, Jupiter and a Proxima exoplanet). Their p95 frame times were 17.7–17.8 ms. The exoplanet p95 improved from about 26.9 ms in the baseline to 17.7 ms in the packaged build. Jupiter had a single measured maximum frame of 38.7 ms; resource arrival and uploads can still cause brief stalls. This is a local result on the development Mac, not a universal FPS guarantee.

Both local bundles passed `codesign --verify --deep --strict`; both local DMGs passed `hdiutil verify`. A clean startup exposes 560 catalog objects while detailed extrasolar texture residency remains near zero until travelling to a system. Departure checks confirm that generated detail is released.

[Public v1.6.0 release](https://github.com/gtts-ux/cosmosEngine/releases/tag/v1.6.0) includes both architecture installers and SHA-256 checksums. Both direct DMG download links returned HTTP 200 after publication. [Release workflow](https://github.com/gtts-ux/cosmosEngine/actions/runs/39813183522).
