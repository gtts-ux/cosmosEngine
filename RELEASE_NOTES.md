Galaxy exploration and terrain polish in CosmosEngine-Mac 1.7.0.

- Ground tiles share the globe’s lighting and fade across a broad, overlapping opacity mask. Close-up material contrast preserves the planet’s regional palette. Small bodies progressively stream higher-detail procedural maps; microrelief scales down on tiny moons.
- Mars uses NASA MOLA 0.25-degree measured elevations. Earth uses a NASA GEBCO geographic relief raster with approximate heights. Local rocks and fine surface detail remain procedural reconstructions.
- Expanded the HYG catalog from 55 to 256 real nearby primary stars. Newly added systems populate when approached or inspected.
- Explore the Milky Way, Andromeda, Triangulum and both Magellanic Clouds. Galaxy map shows the distant structure; Enter galaxy opens a local neighborhood. Fictional stars generate in fixed sectors within 10 ly on Performance, 20 ly on Balanced and 50 ly on High fidelity. Planetary systems and moons load on approach. Old generated systems are released.
- Added Sagittarius A* and M31* with Schwarzschild-size horizons and illustrative accretion disks. They cannot be landed on.

Galaxy structures, procedural stars, planets and moons are reconstructions; catalog stars are labeled separately. Black-hole rendering is an artistic approximation, not general-relativistic ray tracing. Earth’s normalized height raster is not a precision DEM. Mars’s measured grid is approximately 15 km per pixel at the equator; finer detail is illustrative.

Choose x64 for Intel or arm64 for Apple Silicon. Builds are ad-hoc signed, not notarized. The App updates button downloads and verifies the installer; quit the app and replace it in Applications.
