import {seedFor} from './surfaces.js';
export const LIGHT_YEAR_KM=9.4607304725808e12;
export const isStar=body=>!!body&&(body.id==='sun'||body.isStar===true);
export function hostStarId(body,byId){
  const seen=new Set();let current=body;
  while(current&&!isStar(current)&&!seen.has(current.id)){seen.add(current.id);current=byId[current.parent];}
  return current&&isStar(current)?current.id:'sun';
}
export function systemName(star){return star.id==='sun'?'Solar System':`${star.name} system`;}
export function bodiesInSystem(bodies,hostId){const byId=Object.fromEntries(bodies.map(b=>[b.id,b]));return bodies.filter(b=>hostStarId(b,byId)===hostId);}
export function currentSystem(position,stars){
  let best=null,distance=Infinity;
  for(const star of stars){const p=star.anchor||[0,0,0],d=Math.hypot(...position.map((v,i)=>v-p[i]));if(d<distance){distance=d;best=star;}}
  if(!best)return null;
  let influence=LIGHT_YEAR_KM*.5;
  for(const other of stars)if(other.id!==best.id)influence=Math.min(influence,Math.hypot(...(best.anchor||[0,0,0]).map((v,i)=>v-(other.anchor||[0,0,0])[i]))*.35);
  return distance<=influence?best.id:null;
}
export const GENERATION_TYPES=['random','rocky','ocean','ice','gas'];
export const MAX_GENERATED=256,MAX_PER_SYSTEM=16;
export function randomSequence(seed){let state=seedFor(String(seed));return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function generatePlanet(host,descriptor){
  if(!isStar(host))throw new Error('A planet must orbit a catalog star.');
  const {seed,index}=descriptor,random=randomSequence(`${host.id}:${seed}:${index}`);
  const surfaceType=descriptor.type==='random'?['rocky','rocky','ocean','ice','gas'][Math.floor(random()*5)]:descriptor.type;
  if(!GENERATION_TYPES.includes(surfaceType)||!Number.isInteger(index)||index<0||index>=MAX_PER_SYSTEM)throw new Error('Invalid planet descriptor.');
  const radius=surfaceType==='gas'?20000+random()*50000:surfaceType==='ice'?1800+random()*6000:2600+random()*6800;
  const density=surfaceType==='gas'?.8+random()*.9:surfaceType==='ice'?1.5+random()*1.4:3.5+random()*2;
  const mass=4/3*Math.PI*(radius*1000)**3*density*1000;
  const starMass=host.mass/1.9885e30,luminosity=host.id==='sun'?1:host.luminosity||.01;
  const a=Math.max(.006,Math.sqrt(luminosity)*.16)*1.85**index*(.95+random()*.1);
  const period=365.256*Math.sqrt(a**3/starMass);
  const id=`generated-${host.id}-${String(seed)}-${index}`;
  const palette={rocky:['#b9a08b','#c27f58','#969b9a'],ocean:['#528b96'],ice:['#b8cbd7'],gas:['#d7b68f','#88bfc5','#b5a6d1']};
  const colors=palette[surfaceType],color=colors[Math.floor(random()*colors.length)];
  const name=descriptor.name||`${host.name} ${String.fromCharCode(98+index)}`;
  return {id,name,parent:host.id,kind:'Planet',generated:true,seed:String(seed),surfaceType,radius,mass,period,
    gravity:6.67430e-11*mass/(radius*1000)**2,color,tilt:random()*40,rotation:.5+random()*2,
    atmosphere:surfaceType==='gas'?'Hydrogen · Helium (generated)':surfaceType==='ocean'?'Nitrogen · Water vapor (generated)':surfaceType==='ice'?'Thin volatile atmosphere (generated)':'Thin dust atmosphere (generated)',
    atmospherePreset:surfaceType==='gas'?'neptune':surfaceType==='ocean'?'earth':surfaceType==='rocky'?'mars':null,
    orbit:[a*149597870.7,.005+random()*.08,random()*7,random()*360,random()*360,random()*360],
    ...(surfaceType==='gas'?{texture:seedFor(id)%3===0?'2k_saturn.jpg':'2k_jupiter.jpg'}:{}),
    procedural:surfaceType==='ice'?'ice':'rock',
    description:`A fictional, procedurally generated ${surfaceType} world around ${host.name}. Its orbit follows a Keplerian model; surface features are reconstructed.`,
  };
}
// Persistence stores compact, validated generation recipes, never arbitrary body data or paths.
export function sanitizeWorlds(input,stars){
  const validHosts=new Set(stars.filter(isStar).map(s=>s.id)),descriptors=[],seen=new Set(),counts=new Map();
  if(input?.version!==1||!Array.isArray(input.planets))return {version:1,planets:[]};
  for(const d of input.planets.slice(0,MAX_GENERATED)){
    if(!d||!validHosts.has(d.hostId)||!GENERATION_TYPES.includes(d.type)||typeof d.seed!=='string'||!/^[a-zA-Z0-9-]{1,48}$/.test(d.seed)||!Number.isInteger(d.index)||d.index<0||d.index>=MAX_PER_SYSTEM)continue;
    const key=`${d.hostId}:${d.index}`;if(seen.has(key))continue;seen.add(key);
    const name=typeof d.name==='string'?d.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,48):'';
    descriptors.push({hostId:d.hostId,seed:d.seed,index:d.index,type:d.type,name});counts.set(d.hostId,(counts.get(d.hostId)||0)+1);
  }
  return {version:1,planets:descriptors};
}
export function restorePlanets(state,stars){const byId=Object.fromEntries(stars.map(s=>[s.id,s]));return sanitizeWorlds(state,stars).planets.map(d=>generatePlanet(byId[d.hostId],d));}
