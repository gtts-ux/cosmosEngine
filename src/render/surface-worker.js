import {loadElevation} from '../data/elevation.js';
import {sectorStars} from '../data/galaxies.js';
import * as THREE from 'three';
import {proceduralPixels} from './textures.js';
import {TerrainBuilder} from './terrain-builder.js';
import {SurfaceAtlas} from './geography.js';
import {shapeFactor} from '../data/shapes.js';
function pack(geometry){const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{array:a.array,size:a.itemSize}]));return {attributes,index:geometry.index.array,groups:geometry.groups};}
self.onmessage=async({data:job})=>{
 try{
  let result;
  if(job.type==='sectors'){self.postMessage({id:job.id,result:sectorStars(job.position,job.radius)});return;}
  if(job.type==='texture')result=proceduralPixels(job.body,job.width);
  else if(job.type==='terrain'){await loadElevation();result=pack(new TerrainBuilder(job).makeGeometry(job.segments));}
  else if(job.type==='globe'){
   await loadElevation();
   const geo=new THREE.SphereGeometry(1,job.segments,job.segments/2),pos=geo.attributes.position,atlas=new SurfaceAtlas({});atlas.cache.set(job.body.id,job.atlas);
   for(let i=0;i<pos.count;i++){const d=new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).normalize(),sample=atlas.macro(job.body,d),scale=shapeFactor(job.body,d.toArray())+sample/(job.body.radius*1000);pos.setXYZ(i,d.x*scale,d.y*scale,d.z*scale);}
   geo.computeVertexNormals();result=pack(geo);
  }else throw new Error('Unknown surface task');
  const transfer=job.type==='texture'?[result.data.buffer]:[...Object.values(result.attributes).map(a=>a.array.buffer),result.index.buffer];
  self.postMessage({id:job.id,result},transfer);
 }catch(error){self.postMessage({id:job.id,error:error.message});}
};
