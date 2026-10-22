Automatic populated systems, streamed detail, improved exoplanet surfaces and an update button.

- Every nearby star now has four deterministic fictional planets. A clean profile adds 220 planets and 235 stable-orbit moons to the fixed catalog. Existing custom planets and their seeds are preserved. No separate system generation/load action is needed.
- Distant systems retain lightweight data; nearby orbital calculations, terrain and maps activate automatically. A worker builds maps and elevation meshes, old tiles stay visible until replacements are ready, and unused detail is released on departure.
- Reduced terrain tessellation and hidden-body work; added adaptive scene resolution with a Settings toggle. The HUD retains its normal resolution. Performance depends on hardware, display size and scene.
- Exoplanet ground now uses photographed, body-fixed triplanar rock, sand, grass and ice materials, normal/roughness detail and planet-specific colors. Ocean waves are filtered to reduce repetitive lines.
- Jupiter/Saturn use 4096 × 2048 cloud imagery near the planet. Fictional gas giants use photo-derived cloud templates with seeded variation and animated cloud motion. Stars and gas giants still reject landing; free flight can enter giant atmospheres.
- Added **↥ App updates**: check GitHub, download the matching Mac installer and verify its SHA-256 checksum. Open the verified installer, quit CosmosEngine and replace the app in Applications. Saved worlds/settings are retained. These ad-hoc builds use the installer flow rather than silent replacement.

Generated worlds, moons, terrain and altered gas imagery are fictional reconstructions. Stellar catalog estimates and approximate Keplerian dynamics remain unchanged.

Choose x64 for Intel Macs or arm64 for Apple Silicon. Requires macOS 12+. Builds are ad-hoc signed and are not Apple notarized. Exploration works offline; update checks/downloads require internet.
