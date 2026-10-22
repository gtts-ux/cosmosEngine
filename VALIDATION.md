# Version 1.5 validation — 22 October 2026

Development hardware: Intel Mac, macOS 14.8.2, Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Desktop tests block HTTP/HTTPS and use isolated profiles.

The numerical suite covers orbital mechanics, time, settings, geographic coordinates, terrain, telescope limits, landing restrictions, irregular shapes, atmospheres, nearby stars, deterministic generation and interstellar coordinate precision. New checks cover normalized/seam-continuous mountain coordinates, small-body elevation bounds, flat ocean elevation and gas classification.

Desktop checks cover the existing Solar System, all solid catalog surfaces, free flight, selection/travel, atmosphere extinction, LOD transitions, generation and persistence. The new visual suite measures rendered star pixels against a frame with catalog star points disabled, checks free-flight entry/exit through all four catalog giants, confirms dense interior extinction and landing rejection, checks mountain mesh elevation and renders generated ocean worlds and ground.

Results are recorded in ignored `test-output/` reports. Only Intel runtime behavior is tested on this development hardware. Both installer architectures are built and verified. Builds use ad-hoc signatures and are not Apple notarized.

Limits: added elevations and fine surfaces are procedural reconstructions, not surveyed terrain. Generated planets and their maps are fictional. Stellar sizes/masses are spectral estimates and the HYG primary-star snapshot omits binary companions/proper motion. Bright minimum-size star markers are a visibility aid. Atmospheric interiors are visual approximations; fluid dynamics and deep giant interiors are not simulated.

Results: all 25 numerical tests passed. The packaged Intel app passed all 21 Solar System regression groups, all 11 generated-system/persistence groups and all five visual groups, without renderer or shader errors. All 55 non-Solar catalog stars produced a measurable bright signal in the neighborhood pixel probe. The final stationary Earth orbital regression view reported 60 FPS at medium quality; this is a local observation, not a performance guarantee.

Both local app bundles passed `codesign --verify --deep --strict`, and both DMGs passed `hdiutil verify`. [The public v1.5.0 release](https://github.com/gtts-ux/cosmosEngine/releases/tag/v1.5.0) contains Intel and Apple Silicon installers and SHA-256 checksums; both direct DMG download links returned HTTP 200. [Release workflow](https://github.com/gtts-ux/cosmosEngine/actions/runs/39797695946).
