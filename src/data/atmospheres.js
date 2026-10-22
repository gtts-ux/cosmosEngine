// Optical presets are visual approximations, with metric altitude/scale height.
const presets={
 earth:{height:120000,scale:8500,optical:.24,color:'#6d9ed3',distortion:.00012},
 mars:{height:90000,scale:11000,optical:.065,color:'#c49576',distortion:.00004},
 venus:{height:250000,scale:18000,optical:110,color:'#bc8c48',distortion:.0009},
 titan:{height:400000,scale:45000,optical:38,color:'#b47e36',distortion:.0007},
 jupiter:{height:2200000,scale:180000,optical:130,color:'#ba9877',distortion:.0008},
 saturn:{height:2000000,scale:180000,optical:130,color:'#c1ac78',distortion:.0008},
 uranus:{height:1200000,scale:110000,optical:100,color:'#77b8be',distortion:.0005},
 neptune:{height:1200000,scale:110000,optical:100,color:'#457eae',distortion:.0005},
 pluto:{height:70000,scale:12000,optical:.004,color:'#759cc6',distortion:0},
};
export function atmosphereFor(id){return presets[id]||null;}
export function verticalTransmission(id,altitude=0){const p=atmosphereFor(id);return p?Math.exp(-p.optical*Math.exp(-Math.max(0,altitude)/p.scale)):1;}
