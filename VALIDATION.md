# Version 1.4 validation — 22 October 2026

Development hardware: Intel Mac, macOS 14.8.2. Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Desktop tests block HTTP/HTTPS and use isolated test profiles.

The 23 numerical checks cover orbital mechanics, time, settings, geography, terrain, telescope limits, landing restrictions, irregular shapes, atmospheres, 55 added stellar entries, deterministic generation, parent-system membership, physical system detection, recipe validation and system-local position precision.

The original desktop checks cover the existing Solar System, selection/travel, navigation, terrain, atmospheres, sunspots, graphics and IPC restrictions. A separate systems test covers star/system browsing without travel, generation through the UI, extrasolar travel, local-coordinate landing/walking, generated-gas landing rejection, system seeding, neighborhood overview, return to Solar System, invalid generation requests and recipe restoration after restarting the application.

The release workflow runs the numerical tests and packages/verifies both macOS architectures. Only Intel runtime behavior is tested on this development hardware. Builds use ad-hoc signatures and are not Apple notarized.

Limits: the HYG v4.1 subset is a static approximate catalog snapshot of primary entries. Proper motion, companions and binary dynamics are omitted. Spectral stellar properties are estimates. Generated planets, maps and fine terrain are fictional reconstructions. Keplerian planetary motion ignores mutual perturbations.
