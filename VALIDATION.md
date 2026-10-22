# Version 1.7 validation

Local model tests: 33 passed, including deterministic, bounded, quality-nested galaxy sectors; black-hole radii and landing rejection; MOLA heights for Olympus Mons, Hellas and northern plains; Earth mountain/ocean locations; previous orbital, persistence and updater checks. The renderer build succeeds.

The local execution environment currently aborts Electron and headless Chrome before they open the renderer; LaunchServices reports an executable launch error. The Intel app bundle builds and passes code-signature verification. Local DMG creation fails with `hdiutil: Device not configured`. These environment failures do not establish visual correctness.

The release workflow now gates Mac packaging on a desktop graphics regression suite. That suite checks four solid surfaces, black-hole rendering, all five galaxy regions, 10/20/50 ly streaming ranges, selecting without moving, generated-system travel and bounded system residency. Screenshots and the report are retained as workflow artifacts. Results will be recorded after execution.

Known limits: galaxy structure and unresolved stars are procedural; local detailed stars are generated only inside the configured radius. Galaxy overview points represent distant aggregate structure. Earth heights are approximate; Mars elevations are measured at 0.25° resolution. Surface microdetail and accretion disks are illustrative. No new FPS claim is made without a completed runtime benchmark.
