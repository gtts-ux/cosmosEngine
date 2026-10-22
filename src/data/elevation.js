import {surfaceCoordinates} from './geography.js';
const grids=new Map();let promise;
export function installElevation(id,array){if(array.length!==1440*720)throw new Error('Invalid elevation grid');grids.set(id,array);}
export function loadElevation(){return promise||=(async()=>{for(const id of ['earth','mars']){const response=await fetch(`assets/data/${id}-elevation.bin.gz`);if(!response.ok)throw new Error(`Missing ${id} topography`);installElevation(id,new Int16Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));}})();}
export function surveyHeight(id,direction){const grid=grids.get(id);if(!grid)return null;const {u,v}=surfaceCoordinates(direction),x=u*1440-.5,y=Math.max(0,Math.min(719,v*720-.5)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(a,b)=>grid[Math.min(719,b)*1440+((a%1440)+1440)%1440];return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
