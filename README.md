# CosmosEngine-Mac

An offline Mac solar-system explorer with free flight and detailed landing environments.

**Download:** [Intel Mac installer](https://github.com/gtts-ux/cosmosEngine/releases/latest/download/CosmosEngine-Mac-1.1.0-x64.dmg) · [Apple Silicon installer](https://github.com/gtts-ux/cosmosEngine/releases/latest/download/CosmosEngine-Mac-1.1.0-arm64.dmg) · [All releases](https://github.com/gtts-ux/cosmosEngine/releases)

Open the DMG and drag CosmosEngine-Mac into Applications. Requires macOS 12+ and WebGL 2. The installed app needs no Node.js, browser, server, or internet connection.

Builds use local ad-hoc signatures and are not Apple Developer ID notarized. If macOS blocks opening the downloaded app, use System Settings → Privacy & Security to allow it. Do not disable Gatekeeper globally.

## Landing environments

Click **Land** on a selected world. Detailed ground materials appear only after the landing transition; orbital views keep their global planetary maps.

- **Earth:** choose grassland, beach/sand, or animated ocean. Photographed albedo, normal, and roughness maps provide close-up material detail. Grassland has instanced grass; beaches have rocks, a shoreline, and water reflections.
- **Rocky worlds:** cratered regolith, rocky plains, iron-rich Martian soil, and basaltic Venus terrain.
- **Moons:** fractured ice, frost, grooved terrain, volcanic sulfur plains, and hydrocarbon dunes. Jupiter’s four large moons and Saturn’s major moons have individual surface appearances.
- **Dwarf planets:** Ceres, Pluto, Eris, Haumea, and Makemake have landable reconstructed terrain. Pluto uses a New Horizons global map; Ceres uses Dawn imagery.
- **Gas giants:** cloud-top views with a cloud deck and elevated camera, rather than solid ground.

Landing scenes are representative local reconstructions with photographed Earth material samples and procedural detail, not surveys of the exact geographic point under the globe. They are bounded local patches, not an entire planet of streamed terrain. Use WASD to explore the patch and O to return to orbit. Ocean mode is a low-altitude view above the water, not swimming.

## Catalog

38 objects: the Sun, eight planets, five recognized dwarf planets, three other major asteroids, and 21 moons.

- Earth: Moon.
- Mars: Phobos, Deimos.
- Jupiter: Io, Europa, Ganymede, Callisto.
- Saturn: Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus.
- Uranus: Miranda, Ariel, Umbriel, Titania, Oberon.
- Neptune: Triton.
- Pluto: Charon.

Seventeen moon/small-body globes use USGS spacecraft-derived mosaics. Pluto uses NASA’s New Horizons map. Worlds without suitable global imagery use illustrative maps. This is a catalog of major moons, not every known small satellite.

## Controls

| Action | Control |
| --- | --- |
| Select and travel to a world | Explorer, scene click, or search |
| Search | ⌘K |
| Orbit / zoom | Drag / scroll |
| Enter free flight / return to orbit | F / O |
| Fly or move across landing terrain | W A S D |
| Vertical thrust / roll in flight | Up/Down arrows / Q E |
| Look in flight or on the surface | Drag; hold right mouse in free flight for pointer lock |
| Flight speed | Scroll in flight or logarithmic speed slider |
| Boost | Shift |
| Warp to selected target | G |
| Enter landing / cloud-top view | L |
| Pause / reset to current time | Space / R |
| Hide or restore interface | H |

Free-flight speed ranges from 1 m/s to 1 light-year/s, with inertia and swept-segment collision checks. Surface movement is 5 m/s, or 20 m/s with Shift, within the local patch.

Time supports pause and forward/reverse rates from 0.001× to 1,000,000×. True scale uses physical radii and orbital distances. Balanced mode enlarges bodies and satellite systems for visibility; telemetry always uses physical quantities.

## Build from source

Node.js 24+, macOS, and Xcode Command Line Tools:

```sh
npm ci --ignore-scripts
node node_modules/electron/install.js
npm start
```

The first build downloads the licensed assets listed in `assets/manifest.json`, verifies their source SHA-256 checksums, and prepares them locally. TIFF normal/specular maps are converted using macOS sips. Downloads are a build-time step; the packaged app runs offline. Planetary texture binaries are excluded from Git to keep the repository small.

```sh
npm test                 # Orbital, clock, settings, and terrain tests
npm run test:app         # Real Electron rendering and interaction checks
npm run pack             # Intel .app
npm run dist             # Intel and Apple Silicon DMGs, sequentially
npm run dist:intel
npm run dist:arm
```

The smoke test uses a separate `.test-profile`, blocks HTTP/HTTPS requests, and writes screenshots and a JSON report to `test-output`. Set `COSMOS_PACKAGED_PATH` to a packaged executable to run the same test against the `.app`. Only the Intel build has been executed on the development hardware.

The GitHub Actions workflow builds both architectures, verifies the DMGs, and publishes them with SHA-256 checksums under a versioned GitHub Release.

## Rendering and science

Electron 44.9.2, Three.js/WebGL 2, modular JavaScript, locally compiled Tailwind CSS, and electron-builder. The renderer uses a camera-relative floating origin and logarithmic depth. CPU positions are double precision; one render unit equals 1,000 km. Near clip is 1 mm and the far clip is about 10,570 light-years. Free flight has no scene boundary, but content consists of this solar system and its star background; other star systems are not generated.

Planet positions use [JPL approximate elements and rates](https://ssd.jpl.nasa.gov/planets/approx_pos.html) and a Newton solution of Kepler’s equation. The Earth-Moon barycenter is split by mass ratio. The clock stops at the 1800–2050 model boundary. UTC is used as an approximation to ephemeris time. Light-time, TT/TDB, relativistic, and observer corrections are not applied. Moon, dwarf-planet, and asteroid orbits use simplified mean elements; phases are not precision predictions.

Global rendering includes animated simplex-noise solar shading, Earth’s separate night/cloud layers and ocean specular map, thin-shell Rayleigh/Mie approximations, ring banding, analytic ring and moon shadows, a Milky Way background, and bloom. Atmospheres are visual approximations rather than integrated multiple scattering. Landing terrain uses local metric geometry, curvature, deterministic relief/craters, photographed material maps, and instancing. Global orientations use approximate tilts/spin, not full IAU pole models.

The sandboxed renderer has no Node.js integration. Context-isolated IPC validates senders and texture names; settings use schema-filtered, atomic writes. External navigation is blocked and all runtime resources use a restricted local protocol. Settings live under Electron’s user-data directory.

See [CREDITS.md](CREDITS.md), [RELEASE_NOTES.md](RELEASE_NOTES.md), and [VALIDATION.md](VALIDATION.md).
