# CosmosEngine-Mac

An offline Mac explorer with the Solar System, nearby stars, procedural planets, free flight and detailed landing environments.

**Download:** [Intel Mac installer](https://github.com/gtts-ux/cosmosEngine/releases/latest/download/CosmosEngine-Mac-1.5.0-x64.dmg) · [Apple Silicon installer](https://github.com/gtts-ux/cosmosEngine/releases/latest/download/CosmosEngine-Mac-1.5.0-arm64.dmg) · [All releases](https://github.com/gtts-ux/cosmosEngine/releases)

Open the DMG and drag CosmosEngine-Mac into Applications. Requires macOS 12+ and WebGL 2. The installed app needs no Node.js, browser, server, or internet connection.

Builds use local ad-hoc signatures and are not Apple Developer ID notarized. If macOS blocks opening the downloaded app, use System Settings → Privacy & Security to allow it. Do not disable Gatekeeper globally.

## Nearby stars and generated systems

The catalog includes **55 nearby stars in addition to the Sun**, including Proxima Centauri, Alpha Centauri A, Barnard’s Star, Sirius, Tau Ceti and Epsilon Eridani. Their approximate J2000 positions and distances come from the HYG v4.1 catalog. The neighborhood view shows catalog positions. Nearby stars have bright colored cores and glow so they remain visible against the distant background; their minimum screen size is a visibility aid, not a physical angular diameter.

- Choose the **Stars** tab, use search, or select a system from **Browse system**. Inspecting a star changes the sidebar to its system without moving the camera.
- Click **Go to** or press G to travel. The current-system label follows your physical location; free flight between systems switches the catalog on arrival.
- Click **＋ Planet** to create a world around the system you are browsing. Choose a name, random/rocky/ocean/ice/gas type and an optional seed. Click Go to after creating it.
- On an empty extrasolar system, **Seed system** creates four fictional planets. Existing planetary systems are preserved; you can add individual worlds.
- Generated worlds use deterministic textures, approximate physical properties and Keplerian orbits around their own host star. Solid worlds have automatic local terrain and landing; generated gas giants reject landing.
- Generated recipes are saved atomically under the app’s user-data directory in `worlds.json` and restored on restart. Up to 16 generated planets per host and 256 total are supported.
- **⤢ Star map** opens a neighborhood overview. The large system heading opens that system’s planetary overview.

The star catalog contains primary entries only; binary companions, proper motion and stellar orbital motion are not simulated. Stellar mass/radius/luminosity are spectral estimates. Extrasolar planet discoveries are not bundled: planets created here are labelled **Generated**, are fictional, and are separate from the measured star positions. The catalog snapshot is not a complete or current census of nearby stars. The derived stellar table is licensed under CC BY-SA 4.0; see [DATA-LICENSE.md](DATA-LICENSE.md).

System-local CPU coordinates and a camera-relative GPU origin keep ground movement precise after interstellar travel. Planet illumination follows the host star, and only the nearby system’s planetary geometry/orbits are shown.

Generated maps use 2K albedo with multiscale mineral detail, irregular coastlines, shallow/deep oceans and polar frost. Ocean worlds also have independent cloud layers and water specular highlights. Existing spacecraft/global maps are preserved.

## Landing environments

Fly toward any planet, moon, asteroid, or dwarf planet: local detail loads automatically as you approach. You can descend entirely with free-flight controls. **Land** remains an optional shortcut to the ground beneath your current position.

- **Earth:** ocean, vegetation, desert/sand, exposed rock, and snow/ice are classified from the installed global albedo map at your actual latitude/longitude. Coastlines follow that map. Manual random biome presets have been removed.
- **Other solid worlds:** color follows each world's global map, with regolith, iron-rich dust, sulfur, frost, or ice detail appropriate to that body. Lunar rock detail is neutral gray; the photographed rocky material's moss colors are removed.
- **All catalog worlds:** detailed patches recenter as you move, and their body-fixed relief repeats at the same coordinates. The globe remains visible beyond the patch. Nearby free flight follows orbital translation and spin, including accelerated simulation time.
- **Gas and ice giants:** no landing button, surface scene, or keyboard landing. The Sun also rejects landing. Free flight passes through cloud tops and into their opaque atmospheres, with moving cloud haze and deeper darkness; there is no solid floor.

Orbital albedo blends into regional material detail and then close-up normals/roughness as you approach. Large mountain ranges share a continuous body-fixed elevation model across globe meshes, ground tiles and collisions. Fine relief fades in gradually, keeping the same globe image as the color source at every level. Patches extend up to 64 km and recenter during flight.

Regional colors and Earth material selection follow available global imagery, whose resolution limits coastlines and biome accuracy. Mountains, small relief/craters and fine material detail are reconstructed, not surveyed elevation, satellite land-cover data, buildings, or photogrammetry. Worlds without spacecraft maps still use illustrative global maps. The camera stays above the rendered terrain; ocean views remain above water.

## Catalog

105 fixed catalog objects: the Sun, 55 additional stars, eight Solar System planets, five recognized dwarf planets, three other major asteroids, and 33 moons. Saved generated worlds appear in their own host systems.

- Earth: Moon.
- Mars: Phobos, Deimos.
- Jupiter: Io, Europa, Ganymede, Callisto, Metis, Adrastea, Amalthea, Thebe.
- Saturn: Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus, Hyperion, Pan, Daphnis, Atlas, Prometheus, Pandora, Epimetheus, Janus.
- Uranus: Miranda, Ariel, Umbriel, Titania, Oberon.
- Neptune: Triton.
- Pluto: Charon.

Seventeen moon/small-body globes use USGS spacecraft-derived mosaics. Edge-connected white no-data regions in incomplete mosaics are filled with documented procedural terrain; measured regions remain intact. Generated atlases use continuous spherical noise/craters and correct color encoding, replacing the old repeating bands. Global maps wrap at the longitude seam. Pluto uses NASA’s New Horizons map. Worlds without suitable global imagery use illustrative maps. This is a catalog of major moons, not every known small satellite.

## Controls

| Action | Control |
| --- | --- |
| Inspect a world without moving | Explorer, scene click, label, or search |
| Travel to the inspected world | Go to button or G |
| Aim and track from your current position | Lock orbit |
| Search | ⌘K |
| Orbit / zoom | Drag / scroll |
| Enter free flight / return to orbit | F / O |
| Fly or move across landing terrain | W A S D |
| Vertical thrust / roll in flight | Up/Down arrows / Q E |
| Look in flight or on the surface | Drag; hold right mouse in free flight for pointer lock |
| Flight speed | Scroll in flight or logarithmic speed slider |
| Boost | Shift |
| Telescope magnification (0.5×–1000×) | Hold Shift and scroll; click telescope indicator to reset to 1× |
| Go to selected target | G |
| Land on a selected solid world | L |
| Pause / reset to current time | Space / R |
| Hide or restore interface | H |

Free-flight speed ranges from 1 m/s to 1 light-year/s, with inertia and swept-segment collision checks. Walking movement is 5 m/s, or 20 m/s with Shift. Free flight can cross the surface continuously as detail recenters. Shift-scroll changes optical magnification while preserving speed and position; ordinary scrolling retains the usual orbit-distance or flight-speed control.

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
npm run test:systems     # Generation, interstellar travel and persistence checks
npm run test:visual      # Rendered star pixels, mountains and giant entry/exit
npm run pack             # Intel .app
npm run dist             # Intel and Apple Silicon DMGs, sequentially
npm run dist:intel
npm run dist:arm
```

The desktop tests use separate `.test-profile` and `.systems-test-profile` directories, blocks HTTP/HTTPS requests, and writes screenshots and a JSON report to `test-output`. Set `COSMOS_PACKAGED_PATH` to a packaged executable to run the same test against the `.app`. Only the Intel build has been executed on the development hardware.

The GitHub Actions workflow builds both architectures, verifies the DMGs, and publishes them with SHA-256 checksums under a versioned GitHub Release.

## Rendering and science

Electron 44.9.2, Three.js/WebGL 2, modular JavaScript, locally compiled Tailwind CSS, and electron-builder. The renderer uses a camera-relative floating origin and logarithmic depth. CPU positions use double precision with a separate system reference anchor; one render unit equals 1,000 km. Near clip is 1 mm and the far clip is about 10,570 light-years. Free flight has no scene boundary, but content includes the Solar System, 55 catalog stars, generated planetary systems and a decorative galactic background.

Planet positions use [JPL approximate elements and rates](https://ssd.jpl.nasa.gov/planets/approx_pos.html) and a Newton solution of Kepler’s equation. The Earth-Moon barycenter is split by mass ratio. The clock stops at the 1800–2050 model boundary. UTC is used as an approximation to ephemeris time. Light-time, TT/TDB, relativistic, and observer corrections are not applied. Moon, dwarf-planet, and asteroid orbits use simplified mean elements; phases are not precision predictions.

Global rendering includes animated simplex-noise solar shading with dark umbra/penumbra sunspots, Earth’s separate night/cloud layers and ocean specular map, thin-shell Rayleigh/Mie approximations, ring banding, analytic ring and moon shadows, a Milky Way background, and bloom. A depth-aware atmospheric pass integrates extinction along view rays, colors the sky and distant terrain, and adds subtle optical shimmer. Dense Venus/Titan and giant-planet air obscures planets, stars, rings, and bloom; nearby ground remains visible. These are optical presets and approximate scattering, not full multiple scattering or measured refraction. Landing terrain uses local metric geometry, curvature, deterministic relief/craters, photographed material maps, and globe-coordinate material selection. Global orientations use approximate tilts/spin, not full IAU pole models. Small moons, several asteroids and Haumea use approximate ellipsoids with uneven detail; Pan and Atlas have equatorial ridges. Navigation, collision and detailed terrain share the same shape field. Small moons keep their physical mean radii and receive a wider arrival view.

The sandboxed renderer has no Node.js integration. Context-isolated IPC validates senders and texture names; settings use schema-filtered, atomic writes. External navigation is blocked and all runtime resources use a restricted local protocol. Settings live under Electron’s user-data directory.

See [CREDITS.md](CREDITS.md), [RELEASE_NOTES.md](RELEASE_NOTES.md), and [VALIDATION.md](VALIDATION.md).
