import {LIGHT_YEAR_KM,randomSequence} from './systems.js';
// Approximate galaxy locations and dimensions; resolved stars outside HYG are fictional.
export function equatorial(ra,dec,distance){const a=ra*Math.PI/12,d=dec*Math.PI/180,e=23.4392911*Math.PI/180,x=Math.cos(d)*Math.cos(a),y=Math.cos(d)*Math.sin(a),z=Math.sin(d);return [x, -y*Math.sin(e)+z*Math.cos(e),-(y*Math.cos(e)+z*Math.sin(e))].map(v=>v*distance);}
export const GALAXIES=[
 {id:'milky-way',name:'Milky Way',center:equatorial(17.761,-29.008,26600),radius:53000,tilt:1.05,arms:4,seed:410,blackHoleMass:4.3e6,core:'sagittarius-a',coreName:'Sagittarius A*'},
 {id:'andromeda',name:'Andromeda',center:equatorial(.712,41.269,2537000),radius:76000,tilt:1.35,arms:2,seed:912,blackHoleMass:1.4e8,core:'m31-core',coreName:'M31*'},
 {id:'triangulum',name:'Triangulum',center:equatorial(1.564,30.66,2730000),radius:30000,tilt:.7,arms:3,seed:553},
 {id:'lmc',name:'Large Magellanic Cloud',center:equatorial(5.392,-69.756,163000),radius:16000,tilt:.4,arms:1,seed:773},
 {id:'smc',name:'Small Magellanic Cloud',center:equatorial(.879,-72.829,200000),radius:10000,tilt:1.8,arms:1,seed:119},
];
GALAXIES[0].tilt=Math.atan2(-GALAXIES[0].center[1],GALAXIES[0].center[2]);
export const detailRadius=quality=>({low:10,medium:20,high:50}[quality]||20);
export function galaxyLocal(g,p){const [x,y,z]=p.map((v,i)=>v-g.center[i]),c=Math.cos(g.tilt),s=Math.sin(g.tilt);return [x,y*c+z*s,-y*s+z*c];}
export function galaxyWorld(g,[x,y,z]){const c=Math.cos(g.tilt),s=Math.sin(g.tilt);return [x,y*c-z*s,y*s+z*c].map((v,i)=>v+g.center[i]);}
export function galaxyAt(p){return GALAXIES.find(g=>{const [x,y,z]=galaxyLocal(g,p);return Math.hypot(x,z)<g.radius&&Math.abs(y)<1800;})||null;}
export function blackHole(id,name,anchor,mass,fictional=false){return {id,name,anchor:anchor.map(v=>v*LIGHT_YEAR_KM),isStar:true,blackHole:true,kind:'Black hole',radius:2.95325*mass,mass:mass*1.9885e30,gravity:1.52e13/mass,period:0,rotation:100,color:'#ffb566',texture:'2k_sun.jpg',atmosphere:'No solid surface · event horizon',luminosity:0,catalogLuminosity:0,fictional,description:`${fictional?'Fictional':'Approximate catalog'} black hole. Event horizon uses the Schwarzschild radius; accretion disk and photon ring are illustrative, not a relativistic ray-tracing solution.`};}
export const BLACK_HOLES=GALAXIES.filter(g=>g.core).map(g=>blackHole(g.core,g.coreName,g.center,g.blackHoleMass));
export function makeSectorStar(g,x,y,z,index,random){
 const anchor=[x*10+random()*10,y*10+random()*10,z*10+random()*10],mass=.1+random()**3*2.2,radius=mass**.8;
 const id=`sector-${g.id}-${x}_${y}_${z}-${index}`;
 return {id,name:`${g.name} ${x}:${y}:${z}–${index+1}`,anchor:anchor.map(v=>v*LIGHT_YEAR_KM),isStar:true,streamedStar:true,fictional:true,galaxy:g.id,kind:'Procedural star',radius:radius*695700,mass:mass*1.9885e30,luminosity:Math.max(.001,mass**3.5),catalogLuminosity:mass**3.5,gravity:274*mass/radius**2,period:0,rotation:25,color:mass<.55?'#ffa27b':mass<1.2?'#ffe8ba':'#d6e7ff',texture:'2k_sun.jpg',atmosphere:'Stellar plasma',description:'Fictional star in a deterministic galaxy sector. Planets and moons stream automatically when this system is approached or inspected.'};
}
// Fixed 10 ly cells make positions independent of quality, traversal order and revisits.
// At most 8 candidates per cell: no galaxy-sized object array is ever allocated.
export function sectorStars(position,radius){
 const galaxy=galaxyAt(position);if(!galaxy)return [];
 const result=[],lo=position.map(v=>Math.floor((v-radius)/10)),hi=position.map(v=>Math.floor((v+radius)/10));
 for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
  const random=randomSequence(`${galaxy.id}:${x}:${y}:${z}`);
  for(let i=0;i<8;i++){
   const star=makeSectorStar(galaxy,x,y,z,i,random),p=star.anchor.map(v=>v/LIGHT_YEAR_KM);
   if(Math.hypot(...p.map((v,k)=>v-position[k]))>radius)continue;
   // Preserve the measured neighborhood, without inventing nearby Solar companions.
   if(galaxy.id==='milky-way'&&Math.hypot(...p)<33)continue;
   if(galaxyAt(p)?.id===galaxy.id)result.push(star);
  }
 }
 return result;
}
