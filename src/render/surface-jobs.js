import * as THREE from 'three';
export class SurfaceJobs {
 constructor(){
  this.serial=0;this.pending=new Map();this.worker=new Worker('surface-worker.js',{type:'module'});
  this.worker.onmessage=({data})=>{const job=this.pending.get(data.id);if(!job)return;this.pending.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data.result);};
  this.worker.onerror=e=>{for(const job of this.pending.values())job.reject(new Error(e.message||'Surface worker failed'));this.pending.clear();};
 }
 run(type,input){const id=++this.serial;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,type,...input});});}
 geometry(data){const geo=new THREE.BufferGeometry();for(const [name,a] of Object.entries(data.attributes))geo.setAttribute(name,new THREE.BufferAttribute(a.array,a.size));geo.setIndex(new THREE.BufferAttribute(data.index,1));for(const g of data.groups)geo.addGroup(g.start,g.count,g.materialIndex);geo.computeBoundingSphere();return geo;}
}
