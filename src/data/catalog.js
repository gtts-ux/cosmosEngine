import {BLACK_HOLES} from './galaxies.js';
import { NEARBY_STARS } from './nearby-stars.js';
import { GROUND_TEXTURES } from './surfaces.js';
// Physical values are rounded mean values; distances/radii in km, mass in kg,
// periods in Earth days. Planet elements are JPL Table 1 (1800–2050).
const planet = (id, name, radius, mass, period, gravity, atmosphere, color, texture, tilt, rotation, elements, rates, description) =>
  ({ id, name, radius, mass, period, gravity, atmosphere, color, texture, tilt, rotation, elements, rates, description, parent: 'sun', kind: 'Planet' });
export const BODIES = [
  { id: 'sun', name: 'Sun', kind: 'G2V star', radius: 695700, mass: 1.9885e30, period: 0, gravity: 274, atmosphere: 'Hydrogen · Helium', color: '#ffcb79', texture: '2k_sun.jpg', tilt: 7.25, rotation: 25.38, description: 'Our star. A sphere of plasma holding eight planets and countless smaller worlds in its gravitational embrace.' },
  planet('mercury', 'Mercury', 2439.7, 3.3011e23, 87.969, 3.7, 'Trace exosphere · O, Na, H', '#b8aaa0', '2k_mercury.jpg', 0.034, 58.646,
    [.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],
    [.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081],
    'A small, cratered world of extremes. Its ancient surface records billions of years of impacts.'),
  planet('venus', 'Venus', 6051.8, 4.8675e24, 224.701, 8.87, '96.5% CO₂ · 3.5% N₂', '#e5c999', '2k_venus_atmosphere.jpg', 177.36, -243.025,
    [.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],
    [.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418],
    'Hidden beneath an unbroken veil of sulfuric acid clouds, Venus is the hottest planet in our solar system.'),
  planet('earth', 'Earth', 6371, 5.97237e24, 365.256, 9.807, '78% N₂ · 21% O₂ · 1% other', '#78c3ff', '8k_earth_daymap.jpg', 23.439, .99726968,
    [1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],
    [.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0],
    'Our pale blue home. Liquid oceans, a protective atmosphere, and the only life we know of in the universe.'),
  planet('mars', 'Mars', 3389.5, 6.4171e23, 686.98, 3.721, '95.3% CO₂ · 2.7% N₂ · 1.6% Ar', '#eaa484', '2k_mars.jpg', 25.19, 1.025957,
    [1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
    [.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343],
    'Rust-red deserts, giant volcanoes, and traces of ancient rivers. A world shaped by water long ago.'),
  planet('jupiter', 'Jupiter', 69911, 1.8982e27, 4332.59, 24.79, 'Hydrogen · Helium · Ammonia clouds', '#e3b993', '2k_jupiter.jpg', 3.13, .41354,
    [5.202887,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],
    [-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106],
    'The giant of our planetary family. Turbulent cloud belts sweep around a vast hydrogen and helium atmosphere.'),
  planet('saturn', 'Saturn', 58232, 5.6834e26, 10759.22, 10.44, 'Hydrogen · Helium', '#e4d5b1', '2k_saturn.jpg', 26.73, .44401,
    [9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],
    [-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794],
    'A world encircled by ice. Countless ring particles trace delicate bands around this low-density gas giant.'),
  planet('uranus', 'Uranus', 25362, 8.681e25, 30688.5, 8.69, 'Hydrogen · Helium · Methane', '#a1d9dd', '2k_uranus.jpg', 97.77, -.71833,
    [19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],
    [-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589],
    'An ice giant tipped on its side. Methane gives its distant atmosphere a quiet blue-green hue.'),
  planet('neptune', 'Neptune', 24622, 1.02413e26, 60182, 11.15, 'Hydrogen · Helium · Methane', '#659cfa', '2k_neptune.jpg', 28.32, .67125,
    [30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],
    [.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664],
    'Cold, remote, and restless. Powerful winds circle the most distant planet in our solar system.'),
  { id:'moon', name:'Moon', parent:'earth', kind:'Natural satellite', radius:1737.4, mass:7.342e22, period:27.321661, gravity:1.62, atmosphere:'Trace exosphere', color:'#c3c4c9', texture:'2k_moon.jpg', tilt:6.68, rotation:27.321661, orbit:[384400,.0549,5.145,218.316,83.353,125.045], description:'Earth’s companion. Dark basalt plains and bright cratered highlands preserve the story of its ancient past.' },
  { id:'io', name:'Io', parent:'jupiter', kind:'Natural satellite', radius:1821.6, mass:8.932e22, period:1.769138, gravity:1.796, atmosphere:'Thin SO₂', color:'#dac779', tilt:0, rotation:1.769138, orbit:[421700,.0041,3.1,210,84,100], description:'The most volcanically active world in our solar system, heated by the tidal pull of Jupiter.', procedural:'volcanic' },
  { id:'europa', name:'Europa', parent:'jupiter', kind:'Natural satellite', radius:1560.8, mass:4.7998e22, period:3.551181, gravity:1.315, atmosphere:'Trace oxygen', color:'#d7c6ad', tilt:.1, rotation:3.551181, orbit:[671034,.009,3.4,60,88,100], description:'A fractured shell of ice above a global ocean. One of the most intriguing places to search for life.', procedural:'ice' },
  { id:'ganymede', name:'Ganymede', parent:'jupiter', kind:'Natural satellite', radius:2634.1, mass:1.4819e23, period:7.154553, gravity:1.428, atmosphere:'Trace oxygen', color:'#a49785', tilt:.3, rotation:7.154553, orbit:[1070412,.0013,3.2,150,192,100], description:'Larger than Mercury, this icy moon has its own magnetic field and a complex, grooved surface.', procedural:'rock' },
  { id:'callisto', name:'Callisto', parent:'jupiter', kind:'Natural satellite', radius:2410.3, mass:1.0759e23, period:16.689018, gravity:1.236, atmosphere:'Trace CO₂', color:'#998b7f', tilt:0, rotation:16.689018, orbit:[1882709,.0074,3.3,270,52,100], description:'An ancient, heavily cratered moon on the outer edge of Jupiter’s great satellite system.', procedural:'rock' },
  { id:'titan', name:'Titan', parent:'saturn', kind:'Natural satellite', radius:2574.7, mass:1.3452e23, period:15.945421, gravity:1.352, atmosphere:'Nitrogen · Methane haze', color:'#dfac5f', tilt:26.7, rotation:15.945421, orbit:[1221870,.0288,27,20,186,114], description:'A hazy world with rivers and lakes of liquid methane, beneath an atmosphere denser than Earth’s.', procedural:'haze' },
  { id:'triton', name:'Triton', parent:'neptune', kind:'Natural satellite', radius:1353.4, mass:2.139e22, period:5.876854, gravity:.779, atmosphere:'Thin nitrogen', color:'#c8b7b1', tilt:157, rotation:-5.876854, orbit:[354759,.000016,157,100,0,132], description:'A frozen moon travelling backwards around Neptune, probably captured from the distant Kuiper belt.', procedural:'ice' },
  ...[
    ['ceres','Ceres',469.7,9.3835e20,1680.5,.28,2.7675,.0758,10.594,95.99,73.6,80.3],
    ['vesta','Vesta',262.7,2.5908e20,1325.9,.25,2.361,.0887,7.14,151.2,151.2,103.8],
    ['pallas','Pallas',256,2.04e20,1686,.21,2.773,.23,34.84,33.2,310.2,173.1],
    ['hygiea','Hygiea',217,8.67e19,2030,.12,3.141,.112,3.83,60,312,283],
  ].map(([id,name,radius,mass,period,gravity,a,e,i,L,p,N]) => ({
    id,name,radius,mass,period,gravity,kind:id==='ceres'?'Dwarf planet':'Asteroid',parent:'sun',
    atmosphere:'None',color:'#9c9a96',tilt:4,rotation:.4,
    orbit:[a*149597870.7,e,i,L,p,N],procedural:'rock',
    description:'A rocky survivor of planet formation in the main asteroid belt between Mars and Jupiter.',
  })),
  ...[
    ['phobos','Phobos','mars',11.27,1.066e16,.31891,.0057,9376,.0151,1.1,18],
    ['deimos','Deimos','mars',6.2,1.476e15,1.26244,.003,23463,.0003,1.8,180],
    ['mimas','Mimas','saturn',198.2,3.749e19,.94242,.064,185539,.0196,28,50],
    ['enceladus','Enceladus','saturn',252.1,1.0802e20,1.370218,.113,238037,.0047,27,125],
    ['tethys','Tethys','saturn',531.1,6.174e20,1.8878,.145,294619,.0001,27,220],
    ['dione','Dione','saturn',561.4,1.095e21,2.736915,.232,377396,.0022,27,90],
    ['rhea','Rhea','saturn',763.8,2.3065e21,4.518212,.264,527108,.001,27,270],
    ['iapetus','Iapetus','saturn',734.5,1.8056e21,79.3215,.223,3560820,.0283,17,310],
    ['miranda','Miranda','uranus',235.8,6.59e19,1.41348,.079,129390,.0013,98,40],
    ['ariel','Ariel','uranus',578.9,1.353e21,2.52038,.269,191020,.0012,98,115],
    ['umbriel','Umbriel','uranus',584.7,1.172e21,4.14418,.234,266300,.0039,98,200],
    ['titania','Titania','uranus',788.9,3.527e21,8.70587,.379,435910,.0011,98,280],
    ['oberon','Oberon','uranus',761.4,3.014e21,13.4632,.346,583520,.0014,98,330],
  ].map(([id,name,parent,radius,mass,period,gravity,a,e,i,L])=>({
    id,name,parent,radius,mass,period,gravity,kind:'Natural satellite',
    atmosphere:'Trace exosphere or none',color:['phobos','deimos','umbriel','iapetus'].includes(id)?'#8b8279':'#c1c6c9',
    tilt:i,rotation:period,orbit:[a,e,i,L,0,0],procedural:parent==='mars'?'rock':'ice',
    description:`A ${parent==='mars'?'rocky':'cratered icy'} moon of ${parent[0].toUpperCase()+parent.slice(1)}. Explore its ridges, craters, and reconstructed close-up surface.`,
  })),
  { id:'pluto',name:'Pluto',parent:'sun',kind:'Dwarf planet',radius:1188.3,mass:1.303e22,period:90560,gravity:.62,
    atmosphere:'Thin nitrogen · Methane · Carbon monoxide',color:'#d3b79c',texture:'pluto-nasa.jpg',tilt:119.6,rotation:-6.38723,
    orbit:[39.482*149597870.7,.2488,17.14,238.929,224.068,110.303],
    description:'A distant dwarf planet with nitrogen glaciers, reddish tholins, and water-ice mountains. Its global map comes from New Horizons.' },
  { id:'charon',name:'Charon',parent:'pluto',kind:'Natural satellite',radius:606,mass:1.586e21,period:6.38723,gravity:.288,
    atmosphere:'None',color:'#b6aca7',tilt:119.6,rotation:6.38723,orbit:[19596,.0002,119.6,110,0,0],procedural:'ice',
    description:'Pluto’s largest moon: an icy world with immense chasms and dark reddish polar material.' },
  ...[
    ['eris','Eris',1163,1.6466e22,203830,.82,67.781,.4407,44.04,204.16,151.64,35.95,'#d1d6da'],
    ['haumea','Haumea',780,4.006e21,103774,.4,43.218,.191,28.19,205.7,240.8,121.9,'#becbd0'],
    ['makemake','Makemake',715,3.1e21,111845,.5,45.715,.1559,28.98,165.5,295.9,79.6,'#c6a484'],
  ].map(([id,name,radius,mass,period,gravity,a,e,i,L,p,N,color])=>({
    id,name,radius,mass,period,gravity,color,kind:'Dwarf planet',parent:'sun',atmosphere:'No substantial atmosphere',
    tilt:15,rotation:1,orbit:[a*149597870.7,e,i,L,p,N],procedural:'ice',
    description:'A remote dwarf planet beyond Neptune, with a frozen surface reconstructed from limited observational constraints.',
  })),
  ...[
    // NASA/NSSDCA mean orbit values; phases are illustrative. Axes are semiaxes (km).
    ['metis','Metis','jupiter',21.5,3.6e16,.294779,128000,.001,3.15,[30,20,17]],
    ['adrastea','Adrastea','jupiter',8.2,2e15,.298260,129000,.002,3.18,[10,8,7]],
    ['amalthea','Amalthea','jupiter',83.5,2.08e18,.498179,181400,.003,3.51,[125,73,64]],
    ['thebe','Thebe','jupiter',49.3,4.3e17,.6745,221900,.018,4.21,[58,49,42]],
    ['pan','Pan','saturn',14,4.95e15,.5750,133583,0,26.73,[17,16,10]],
    ['daphnis','Daphnis','saturn',3.8,7.7e13,.594,136500,0,26.73,[4.3,4.1,3.2]],
    ['atlas','Atlas','saturn',15.1,6.6e15,.6019,137670,0,27.03,[20,18,9]],
    ['prometheus','Prometheus','saturn',43.1,1.59e17,.6130,139353,.00204,26.73,[68,40,30]],
    ['pandora','Pandora','saturn',40.6,1.37e17,.6285,141700,.0042,26.73,[52,41,32]],
    ['epimetheus','Epimetheus','saturn',58.2,5.27e17,.6942,151422,.009,27.07,[65,57,53]],
    ['janus','Janus','saturn',89.2,1.90e18,.6945,151472,.007,26.87,[102,93,76]],
    ['hyperion','Hyperion','saturn',135,5.62e18,21.276609,1500930,.1042,27.16,[180,133,103]],
  ].map(([id,name,parent,radius,mass,period,a,e,i,axes],index)=>({
    id,name,parent,radius,mass,period,axes,gravity:6.67430e-11*mass/(radius*1000)**2,
    kind:'Natural satellite',atmosphere:'None',color:parent==='jupiter'?'#a28c77':'#bcb4a5',
    tilt:parent==='saturn'?26.73:3.13,rotation:period,orbit:[a,e,i,(index*137.5)%360,0,parent==='saturn'?169.5:100.5],
    procedural:parent==='jupiter'?'rock':'ice',irregularity:id==='hyperion'?.11:.035,
    ridge:['pan','atlas'].includes(id)?.15:0,
    description:`A small irregular moon of ${parent==='jupiter'?'Jupiter':'Saturn'}. Its approximate shape follows published dimensions; unmapped terrain is reconstructed.`,
  })),
];
for(const id of ['io','europa','ganymede','callisto','titan','enceladus','mimas','tethys','dione','rhea','iapetus','triton','charon','phobos','deimos','ceres','vesta']) {
  BODIES.find(b=>b.id===id).texture=`${id}-usgs.jpg`;
}
// Small worlds keep their actual mean size; the mesh uses a shared radial shape field.
for(const [id,axes,irregularity] of [
  ['phobos',[13,11.4,9.1],.07],['deimos',[7.8,6,5.1],.045],
  ['vesta',[286,279,223],.025],['pallas',[275,258,238],.035],
  ['haumea',[1161,852,513],.005],
])Object.assign(BODIES.find(b=>b.id===id),{axes,irregularity});
BODIES.push(...NEARBY_STARS,...BLACK_HOLES);
export const TEXTURES = [
  ...BODIES.map(b=>b.texture).filter(Boolean),
  '2k_earth_nightmap.jpg','2k_earth_clouds.jpg','earth-normal.png',
  'earth-specular.png','2k_stars_milky_way.jpg','8k_jupiter.jpg','8k_saturn.jpg',...GROUND_TEXTURES,
];
export const BY_ID = Object.fromEntries(BODIES.map(body=>[body.id,body]));
