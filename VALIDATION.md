# Version 1.8 validation

35 model tests pass locally, including 10 ly generation near the Sun, in all nine galaxies and in deep space; stable shared stars while moving across galaxy boundaries; bounded generation and existing terrain, orbital, settings and updater checks. The renderer build succeeds.

The [final source Mac graphics run](https://github.com/gtts-ux/cosmosEngine/actions/runs/39883097157) passed all nine regression groups with no renderer or streaming errors. It checks actual WASD travel in deep space, new stars entering the moving bubble, local-map centering without camera movement, map-based travel, six M31 sky directions for large white regions, and a visible generated star at the aimed camera center. It also retains terrain, black-hole and bounded-system regression coverage. Screenshots were reviewed for the local map, M31 sky and galaxy overview. Packaged checks gate publication.

Local Electron launch remains unavailable in this environment. Mac CI validates source rendering and the packaged Apple Silicon app; both Intel and Apple Silicon disk images are verified before publication. Intel runtime performance is not established by these checks.

Galaxy geometry and generated star populations are illustrative. The 10 ly limit applies to visible local stars; the worker prefetches a 0.5 ly margin to avoid gaps during flight. Planet details remain streamed on approach. No FPS guarantee is made.
