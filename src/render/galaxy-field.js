import * as THREE from 'three';
import {GALAXIES,galaxyWorld,galaxyAt,detailRadius} from '../data/galaxies.js';
import {LIGHT_YEAR_KM,randomSequence} from '../data/systems.js';
const vertex=`attribute float size;varying vec3 tint;uniform float ratio;void main(){tint=color;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p;gl_PointSize=size*ratio;}`;
const fragment=`varying vec3 tint;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(tint,exp(-r*r*22.0));}`;
function points(positions,colors,sizes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));return new THREE.Points(g,new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{ratio:{value:1}}}));}
export class GalaxyField{
 constructor(universe){this.universe=universe;this.entries=[];this.position=null;this.serial=0;this.disks=[];
  for(const g of GALAXIES){const random=randomSequence(`disk-${g.seed}`),p=[],c=[],s=[];
   for(let i=0;i<12000;i++){
    const r=g.radius*Math.pow(random(),1.65),arm=i%g.arms,angle=arm*Math.PI*2/g.arms+Math.log(1+r/g.radius*30)*2.5+(random()-.5)*(.45+r/g.radius*.3);
    const thickness=(random()+random()+random()-1.5)*g.radius*(i%6===0?.06:.008);
    const world=galaxyWorld(g,[Math.cos(angle)*r,thickness,Math.sin(angle)*r]);p.push(...world.map((v,k)=>v-g.center[k]));
    const core=1-r/g.radius,t=random();c.push(.3+core*.7,.36+core*.4,.52+core*.22);s.push(t>.98?3:1.4);
   }
   const disk=points(p,c,s);disk.frustumCulled=false;universe.scene.add(disk);this.disks.push({g,disk});
  }
  this.neighbors=points([],[],[]);this.neighbors.frustumCulled=false;universe.scene.add(this.neighbors);
 }
 async refresh(position,radius){
  const serial=++this.serial;this.pending=true;this.position=[...position];this.radius=radius;
  try{const entries=await this.universe.jobs.run('sectors',{position,radius});if(serial!==this.serial)return;
   this.entries=entries;const old=this.neighbors.geometry;this.neighbors.geometry=new THREE.BufferGeometry();
   this.neighbors.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(entries.length*3),3));
   this.neighbors.geometry.setAttribute('color',new THREE.Float32BufferAttribute(entries.flatMap(e=>new THREE.Color(e.color).multiplyScalar(2).toArray()),3));
   this.neighbors.geometry.setAttribute('size',new THREE.Float32BufferAttribute(new Float32Array(entries.length).fill(5),1));old.dispose();
   this.universe.onSectorReady?.(entries);
  }catch(e){this.universe.streamError=e.message;}finally{if(serial===this.serial)this.pending=false;}
 }
 update(flight,time){
  const u=this.universe,p=flight.position.toArray().map((v,i)=>(v*1000+u.referenceAnchor[i])/LIGHT_YEAR_KM),radius=detailRadius(u.settings.quality);
  this.currentGalaxy=galaxyAt(p)?.id||null;
  if(!this.pending&&(!this.position||radius!==this.radius||Math.hypot(...p.map((v,i)=>v-this.position[i]))>.5))this.refresh(p,radius);
  const attr=this.neighbors.geometry.attributes.position,sizes=this.neighbors.geometry.attributes.size;
  let closest=null,min=Infinity;
  for(let i=0;i<this.entries.length;i++){
   const b=this.entries[i],d=b.anchor.map((v,k)=>v/LIGHT_YEAR_KM-p[k]),distance=Math.hypot(...d),scale=1e7/Math.max(1,distance);
   attr.setXYZ(i,...d.map(v=>v*scale));sizes.setX(i,distance>radius||u.nodes.has(b.id)?0:5);
   if(distance<min){min=distance;closest=b;}
  }
  attr.needsUpdate=true;sizes.needsUpdate=true;this.neighbors.material.uniforms.ratio.value=u.renderer.getPixelRatio();
  if(min<.5&&!flight.warp)u.onApproachStar?.(closest);
  for(const {g,disk} of this.disks){const d=g.center.map((v,i)=>v-p[i]),scale=1e7/Math.max(g.radius,Math.hypot(...d));disk.position.set(...d.map(v=>v*scale));disk.scale.setScalar(scale);disk.geometry.setDrawRange(0,u.settings.quality==='low'?4000:u.settings.quality==='medium'?8000:12000);disk.updateMatrixWorld(true);}
  this.neighbors.updateMatrixWorld(true);
 }
 pick(x,y){const camera=this.universe.camera,forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),a=this.neighbors.geometry.attributes.position;let best=null,miss=10;
  for(let i=0;i<this.entries.length;i++){if(this.neighbors.geometry.attributes.size.getX(i)===0)continue;const p=new THREE.Vector3().fromBufferAttribute(a,i);if(p.dot(forward)<=0)continue;p.project(camera);const d=Math.hypot((p.x*.5+.5)*innerWidth-x,(-p.y*.5+.5)*innerHeight-y);if(d<miss){miss=d;best=this.entries[i];}}
  return best;
 }
 diagnostics(){return {galaxy:this.currentGalaxy,radiusLY:this.radius,sectorStars:this.entries.length,pending:this.pending,galaxies:this.disks.length};}
}
