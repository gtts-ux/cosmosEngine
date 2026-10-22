# Version 1.3 validation — 22 October 2026

Hardware: Intel Mac, macOS 14.8.2. Electron 44.9.2, Three.js 0.186.1, Node.js 24.21.0. Runtime network requests are blocked during desktop tests.

The 19 numerical tests cover orbital positions/time, settings, geography, terrain, telescope bounds, landing eligibility, irregular shapes, new satellite orbits and atmospheric transmission.

Desktop checks cover all 50 bodies and automatic terrain on all 45 solid worlds. They exercise information-only selection, explicit Go to, stationary orbit locking, surface descent and streaming, telescope controls, accelerated-time tracking, every landing rejection path, repaired image coverage, material LOD transitions, persistence and renderer isolation. Rendering probes check nearby ocean contrast through air and visible sunspot contrast; screenshots cover atmospheres, terrain levels and irregular bodies.

The release workflow builds Intel and Apple Silicon installers, runs numerical tests and verifies DMG integrity. Only Intel runtime behavior is tested on this machine. Builds use ad-hoc signatures and are not Apple notarized.

Limits: satellite phases and spin axes are approximate. Shape details, fine terrain and white no-data image areas are reconstructed. Atmosphere presets use approximate extinction/scattering and optical shimmer. The new moons have procedural maps. No claim of surveyed elevation or spacecraft shape-model accuracy is made.
