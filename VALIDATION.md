# Version 1.1 validation — 21 October 2026

Development hardware: Intel macOS 14.8.2, Node.js 24.21.0, Electron 44.9.2.

## Automated tests

12 Node test cases cover Julian dates, Kepler residuals, ellipse geometry, Earth-Moon barycenter coordinates, model date bounds, forward/reverse/pause/reset, settings validation, terrain models for every landable body, Earth biomes, gas-giant cloud profiles, land-only visibility, dwarf-planet data, material allowlists, and deterministic terrain generation.

The Electron smoke test has 13 groups of interaction and rendering checks. It covers 38-body WebGL 2 rendering, logarithmic depth, time controls, search/warp, scale switching, free flight, Earth grass/beach/ocean views, surface walking and look, terrain removal on return to orbit, persisted settings, texture path rejection, renderer isolation, system overview, solar shaders, HUD, and help. It also enters landing views on Mercury, Venus, Mars, the Moon, Io, Europa, Titan, Enceladus, Pluto, Charon, Ceres, Eris, and Jupiter.

The first full updated-app run passed all 13 groups with no shader errors. The final stationary Earth orbital view reported 60 FPS at Balanced quality with bloom and shadows enabled. This is one local observation, not a guarantee across hardware or scenes. Screenshots and JSON diagnostics are written to `test-output/`.

## Distribution

Both Intel and Apple Silicon installers are built from the same source. The release workflow runs the numerical/terrain tests, checks source-asset hashes, builds each architecture, verifies DMG checksums, and publishes the installers with SHA-256 hashes.

The Intel app is tested on physical Intel hardware. Apple Silicon builds are cross-packaged; physical Apple Silicon execution remains unverified here. App signatures are local ad-hoc signatures, not Apple Developer ID notarization.

## Scope

Terrain is a bounded representative local reconstruction. Earth vegetation and terrain tiles are photographed terrestrial materials; alien ground materials are artistic geological approximations. They are not exact geographic surveys or spacecraft ground photographs. Seventeen global moon/asteroid maps use USGS mission imagery; poorly imaged bodies retain illustrative global maps. Gas giants have cloud-top scenes. Orbits remain approximate within 1800–2050.
