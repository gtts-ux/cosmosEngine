# Version 1.6 validation — 22 October 2026

Development hardware: Intel Mac, macOS 14.8.2; Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Only Intel runtime behavior is tested locally. Installer bundles are built for Intel and Apple Silicon, with ad-hoc signing and no Apple notarization.

The 30 numerical/model checks cover the previous orbital, clock, settings, geographic, terrain, telescope, shape, atmosphere and stellar catalog behavior. Added checks cover deterministic default populations, stable parented moons inside the Hill-sphere limit, preservation of existing recipes, update version/architecture/source selection, streamed checksum verification, corrupt installers, tampering and offline failures.

Desktop suites use isolated profiles and block renderer HTTP/HTTPS. Streaming checks cover automatic populations, browsing without moving, travel with streamed maps/terrain, exoplanet moon landing, additional worlds, texture release on departure, adaptive-resolution settings and restart persistence. The update UI uses an isolated main-process transport fixture; installer opening is stubbed only in that test profile. Production update downloads use the fixed GitHub release endpoint, architecture-specific DMG URLs and release checksums.

The performance script records requestAnimationFrame median/p95/max timings and CPU samples after view warm-up. Baseline and updated results are in ignored test-output reports. These measurements cover specific local views and do not guarantee a minimum FPS on other hardware or during resource uploads.

Limits: all extrasolar planets/moons and terrain are reconstructions. Photo-derived gas templates improve appearance without representing observed exoplanet surfaces. The star catalog omits binary companions and proper motion. Atmospheric interiors are visual approximations; deep-fluid dynamics and exact topography are not simulated. Distant systems retain lightweight shared meshes/data; full detail is streamed near the camera. Updating opens a verified installer and requires replacing the app through the macOS installer window.
