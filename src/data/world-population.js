import {generatePlanet,randomSequence,isStar} from './systems.js';
const AU_KM=149597870.7,G=6.67430e-11;
export function defaultRecipes(stars,custom=[]){
 const occupied=new Set(custom.map(d=>`${d.hostId}:${d.index}`));
 return stars.filter(s=>isStar(s)&&!s.blackHole&&!s.streamedStar&&s.id!=='sun').flatMap(star=>Array.from({length:4},(_,index)=>({hostId:star.id,index,seed:`neighborhood-v1-${star.id}`,type:['rocky','ocean','gas','ice'][index],name:''})).filter(d=>!occupied.has(`${d.hostId}:${d.index}`)));
}
export function generateMoons(planet,star){
 const random=randomSequence(`${planet.id}:moons-v1`),gas=planet.surfaceType==='gas';
 const hill=planet.orbit[0]*(1-planet.orbit[1])*Math.cbrt(planet.mass/(3*star.mass));
 const inner=planet.radius*3.6,outer=hill*.32;
 const count=Math.min(gas?4:2,Math.max(0,Math.floor(Math.log(outer/inner)/Math.log(1.9))+1));
 const cold=(star.luminosity|| (star.id==='sun'?1:.01))/(planet.orbit[0]/AU_KM)**2<.5;
 return Array.from({length:count},(_,i)=>{
  const a=inner*1.9**i,radius=Math.min(gas?3500:planet.radius*.19,planet.radius*(gas?.025:.035)*(1+random()*2.2)),ice=cold||gas&&i>0;
  const mass=4/3*Math.PI*(radius*1000)**3*(ice?1800:2900),period=2*Math.PI*Math.sqrt((a*1000)**3/(G*planet.mass))/86400;
  return {id:`${planet.id}-moon-${i+1}`,name:`${planet.name} ${['I','II','III','IV'][i]}`,parent:planet.id,kind:'Natural satellite',generated:true,generatedMoon:true,automatic:planet.automatic===true,
   seed:`${planet.seed}-moon-${i+1}`,radius,mass,gravity:G*mass/(radius*1000)**2,period,rotation:period,tilt:random()*12,
   color:ice?'#c3c7c9':'#a3998b',surfaceType:ice?'ice':'rocky',procedural:ice?'ice':'rock',atmosphere:'Trace exosphere',atmospherePreset:null,
   ...(radius<200?{axes:[1.35,1,.85],irregularity:.035}:{}),
   orbit:[a,.002+random()*.02,Math.min(175,planet.orbit[2]+random()*3),random()*360,random()*360,random()*360],
   description:`A fictional ${ice?'icy':'rocky'} moon of ${planet.name}. Its deterministic orbit lies within the planet's approximate Hill sphere.`};
 });
}
export function populateWorlds(stars,custom=[]){
 const byId=Object.fromEntries(stars.map(s=>[s.id,s]));
 const automatic=defaultRecipes(stars,custom).map(d=>({...generatePlanet(byId[d.hostId],d),automatic:true}));
 const planets=[...automatic,...custom.map(d=>generatePlanet(byId[d.hostId],d))];
 return planets.flatMap(planet=>[planet,...generateMoons(planet,byId[planet.parent])]);
}
