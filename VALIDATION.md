# Version 1.4 validation — 22 October 2026

Development hardware: Intel Mac, macOS 14.8.2. Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Desktop tests block HTTP/HTTPS and use isolated test profiles.

The 23 numerical checks cover orbital mechanics, time, settings, geography, terrain, telescope limits, landing restrictions, irregular shapes, atmospheres, 55 added stellar entries, deterministic generation, parent-system membership, physical system detection, recipe validation and system-local position precision.

The original desktop checks cover the existing Solar System, selection/travel, navigation, terrain, atmospheres, sunspots, graphics and IPC restrictions. A separate systems test covers star/system browsing without travel, generation through the UI, extrasolar travel, local-coordinate landing/walking, generated-gas landing rejection, system seeding, neighborhood overview, return to Solar System, invalid generation requests and recipe restoration after restarting the application.

The release workflow runs the numerical tests and packages/verifies both macOS architectures. Only Intel runtime behavior is tested on this development hardware. Builds use ad-hoc signatures and are not Apple notarized.

Limits: the HYG v4.1 subset is a static approximate catalog snapshot of primary entries. Proper motion, companions and binary dynamics are omitted. Spectral stellar properties are estimates. Generated planets, maps and fine terrain are fictional reconstructions. Keplerian planetary motion ignores mutual perturbations.

Results: all 23 numerical tests and all 21 Solar System desktop regression groups passed. The packaged Intel application passed all 11 systems checks, including generation, interstellar travel, metre-scale walking at Proxima, free-flight arrival, invalid request rejection and restoration after restart. No renderer or shader errors were reported. The final stationary Earth orbital regression view reported 60 FPS at medium quality; this is a local observation, not a hardware-wide performance guarantee.

Both local app bundles passed `codesign --verify --deep --strict`; both local DMGs passed `hdiutil verify`. The stellar import script reproduced the published catalog byte-for-byte from the checksum-pinned HYG source.

[Public v1.4.0 release](https://github.com/gtts-ux/cosmosEngine/releases/tag/v1.4.0) includes both architectures and SHA-256 checksums. [The release workflow](https://github.com/gtts-ux/cosmosEngine/actions/runs/39791875441) completed successfully for both builds and publication.
