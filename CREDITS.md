# Credits and provenance

## Planet textures

Solar System Scope / INOVE, [Solar Textures](https://www.solarsystemscope.com/textures/).
Distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Bundled images: Mercury, Venus atmosphere, Mars, Jupiter, Saturn, Uranus,
Neptune, Sun, Moon, Earth day/night/cloud/normal/specular maps, and the stars
plus Milky Way panorama. Earth normal and specular TIFFs were converted to PNG
with macOS `sips`; color maps are otherwise unmodified. The provider describes
the maps as based on NASA imagery and elevation data, with enhanced colors and
some reconstructed regions. Satellite and asteroid procedural maps in this app
are illustrative and are not spacecraft image maps.

Higher-resolution Jupiter/Saturn downloads supplied under `8k_` filenames measure
4096 × 2048 pixels. They are loaded near the corresponding bodies. Fictional gas
giants reuse these licensed photographic templates with shader-based orientation,
color and cloud motion changes. These reconstructions are not exoplanet imagery.

## Orbital model

NASA / JPL Solar System Dynamics:
[Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html).
Table 1 values and rates, J2000 mean ecliptic/equinox, 1800–2050 interval.
The Earth tabulation describes the Earth-Moon barycenter.

Physical catalog fields are rounded standard reference values. Satellite and
asteroid elements are simplified illustrative mean orbits, not a live Horizons
download or a high-precision planetary satellite ephemeris.

## Simplex noise

The Sun's 3D simplex implementation is adapted from
[webgl-noise](https://github.com/ashima/webgl-noise), Ashima Arts and
Stefan Gustavson, MIT license:

Copyright (C) 2011 Ashima Arts. All rights reserved.
Copyright (C) 2011–2016 Stefan Gustavson. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Software and icon

- Three.js — MIT, Copyright © 2010–2026 Three.js authors.
- Electron — MIT, Electron contributors.
- Tailwind CSS — MIT, Tailwind Labs contributors.
- electron-builder, esbuild, and Playwright retain their respective licenses.
- CosmosEngine's vector icon and application code were created for this project.

## Version 1.1 landing materials

Photographed albedo, OpenGL normal, and roughness maps from [Poly Haven](https://polyhaven.com), under [CC0](https://creativecommons.org/publicdomain/zero/1.0/): [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock), [Coast Sand 02](https://polyhaven.com/a/coast_sand_02), [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02), and [Snow 02](https://polyhaven.com/a/snow_02). These are terrestrial material samples used in representative reconstructions, not photographs taken on alien surfaces.

Spacecraft-derived global mosaics and shaded relief from [USGS Astrogeology’s planetary WMS](https://astrowebmaps.wr.usgs.gov/webmapatlas/Layers/maps.html): Io, Europa, Ganymede, Callisto (Galileo/Voyager); Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus (Cassini/Voyager); Triton (Voyager 2); Charon (New Horizons); Phobos/Deimos (Viking); Ceres/Vesta (Dawn). Credits include NASA, JPL-Caltech, USGS, DLR, UCLA, MPS, IDA, JHUAPL, and SwRI as applicable. Source imagery can have incomplete coverage, contrast normalization, and shaded-relief processing.

Pluto global color map: [NASA PIA11707](https://science.nasa.gov/image-detail/amf-pia11707/), New Horizons Ralph/MVIC, NASA/JHUAPL/SwRI. Unobserved or poorly observed areas are not high-resolution surveys.

Exact downloaded URLs, credit labels, and SHA-256 hashes are recorded in `assets/manifest.json`. USGS source layers, source URLs, and ground material selections are maintained in `scripts/record-assets.mjs`.

## Version 1.3 additions

Small-moon mean orbit values and approximate axis dimensions: [NASA Jovian Satellite Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), [NASA Saturnian Satellite Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), and [JPL satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). Phases, detailed shape roughness and new-moon maps are illustrative.

White no-data coverage in the Charon and Triton spacecraft mosaics is filled at runtime with reconstructed material. Those regions are not additional spacecraft observations. Small-body meshes approximate published dimensions and do not reproduce mission shape models. Atmospheric colors, optical density, shimmer and sunspot activity are visual reconstructions.

## Version 1.4 stellar neighborhood

The 55 additional primary stellar entries derive from [HYG v4.1](https://github.com/astronexus/HYG-Database), David Nash / Astronomy Nexus, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The subset and coordinate transformations retain that data license; see DATA-LICENSE.md. `scripts/import-nearby-stars.py` can reproduce the subset from the checksum-pinned source table. Display aliases and spectral estimates were added. Catalog positions are not a current precision astrometric solution; binary companions are omitted. Generated planets and terrain are fictional and are not catalog exoplanet observations.

## Version 1.7 galaxy and elevation data

The HYG v4.1 subset now contains 256 primary stars, processed by the existing checksum-pinned importer under CC BY-SA 4.0. Stellar parameters remain spectral estimates. Galaxy positions and scales are approximate: [NASA Andromeda overview](https://www.nasa.gov/universe/galaxies/andromeda-galaxy/). Spiral structure and stars beyond the measured local catalog are fictional visual reconstructions.

Mars elevation: NASA GSFC MOLA Team, Mars Global Surveyor, PDS product MEGT90N000CB, MGS-M-MOLA-5-MEGDR-L3-V1.0, version 2.0. [PDS archive](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/), signed 16-bit meters, 1440 × 720. The included grid rotates longitude from 0–360 to −180–180 and converts to little endian. SHA-256: `dc13be36a6e08181b9db3abdfa5eaea962772c2da3bff0e8563f00bf14babd24`.

Earth relief: [NASA Visible Earth Topography](https://visibleearth.nasa.gov/images/73934/topography), GEBCO 2008 normalized 8-bit elevation visualization, [source raster](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png). Downsampled to 1440 × 720 and mapped to an approximate 0–8000 m display range. Heights are illustrative; this is not a calibrated survey DEM. Included grid SHA-256: `2f63c802fed54e6d6189f371cd707df13e1c9b49a0ca9c27409b0e697a209a9a`. See `scripts/prepare-elevation.py` for conversion.
