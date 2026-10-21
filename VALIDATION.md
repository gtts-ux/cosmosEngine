# Version 1.2 validation — 21 October 2026

Development hardware: Intel Mac, macOS 14.8.2. Electron 44.9.2, Three.js 0.186.1 and Node.js 24.21.0. The sandboxed renderer runs on a local protocol with HTTP/HTTPS blocked by the desktop test.

`npm test` covers 15 numerical, settings, terrain and geography checks. Geography checks include globe-coordinate round trips at poles and the longitude seam, albedo material classification, proximity visibility and telescope limits.

The desktop smoke test covers WebGL 2/logarithmic depth, time controls, search, scale switching, free flight, automatic terrain at known Earth ocean/desert/vegetation/ice coordinates, neutral lunar colors, continuous descent using thrust, kilometre-scale terrain recentering, body-fixed tracking at accelerated simulation time, optional landing and walking, telescope bounds and reset without throttle changes, settings persistence, IPC restrictions, overview, solar shaders, HUD and help. It also renders automatic local detail on every one of the 37 landable catalog bodies.

Both the source app and the packaged Intel 1.2.0 app passed all 17 desktop check groups with no renderer or shader errors. The final stationary Earth orbital view reported 60 FPS at medium quality; this is a local observation, not a performance guarantee. Both local app bundles passed `codesign --verify --deep --strict`, and both local DMGs passed `hdiutil verify`.

[Public v1.2.0 release](https://github.com/gtts-ux/cosmosEngine/releases/tag/v1.2.0) contains both architectures and checksums. [The release workflow](https://github.com/gtts-ux/cosmosEngine/actions/runs/39631657032) completed successfully for both architectures and publication.

Screenshots and JSON diagnostics are written to `test-output/`. Release builds use the same source and offline asset manifest. The GitHub workflow runs the numerical tests, builds both macOS architectures, verifies DMG integrity and publishes installers and SHA-256 checksums.

Only Intel runtime behavior can be validated on this development machine. Apple Silicon installers are packaged separately; an Apple Silicon runtime test is still required. Builds have ad-hoc signatures and are not Apple Developer ID notarized.

Geographic limitations: the global albedo image controls regional color and Earth biome classification; image resolution and color ambiguity limit accuracy. Microrelief and craters are deterministic reconstructions, not elevation measurements. Axial orientation and satellite phases are approximate. Bodies lacking suitable imagery use illustrative maps. The catalog contains major moons rather than every known satellite.
