import * as THREE from 'three';
import {SurfaceAtlas} from './geography.js';
import {shapeFactor} from '../data/shapes.js';
export class TerrainBuilder {
 constructor({body,direction,extent,atlas}){this.body=body;this.anchor=new THREE.Vector3(...direction).normalize();this.frame=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),this.anchor);this.radiusMeters=body.radius*1000;this.extent=extent;this.atlas=new SurfaceAtlas({});this.atlas.cache.set(body.id,atlas);}
 sample(body,d){return this.atlas.sample(body,d);}
 point(x,z){return new THREE.Vector3(x,this.radiusMeters,z).normalize().applyQuaternion(this.frame);}
  makeGeometry(segments){
    const geo=new THREE.PlaneGeometry(this.extent,this.extent,segments,segments);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,basePositions=new Float32Array(pos.count*3),globeUVs=new Float32Array(pos.count*2),types=[],edgeWeights=new Float32Array(pos.count),detailPoints=new Float32Array(pos.count*3);
    const anchorU=this.sample(this.body,this.anchor).u;
    const inverse=this.frame.clone().invert(),detailOrigin=this.anchor.clone().multiplyScalar(this.radiusMeters).divideScalar(4096).floor().multiplyScalar(4096);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),d=this.point(x,z),s=this.sample(this.body,d);
      const bp=d.clone().multiplyScalar(this.radiusMeters).sub(detailOrigin);detailPoints.set([bp.x,bp.y,bp.z],i*3);
      const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z)/this.extent,.27,.47);edgeWeights[i]=1-edge;
      const shapeHeight=(shapeFactor(this.body,d.toArray())-1)*this.radiusMeters;
      const macro=shapeHeight+s.mountain;
      const baseline=d.clone().multiplyScalar(this.radiusMeters+macro).applyQuaternion(inverse);
      basePositions.set([baseline.x,baseline.y-this.radiusMeters,baseline.z],i*3);
      let u=s.u;if(u-anchorU>.5)u-=1;if(u-anchorU<-.5)u+=1;
      globeUVs.set([u,1-s.v],i*2);
      const p=d.multiplyScalar(this.radiusMeters+macro+(s.height-macro)*(1-edge)).applyQuaternion(inverse);
      pos.setXYZ(i,p.x,p.y-this.radiusMeters,p.z);uv.setXY(i,x/12,z/12);
      types.push(s.profile.type==='water'?4:Math.max(0,['grass','sand','rock','ice'].indexOf(s.profile.type==='volcanic'?'rock':s.profile.type==='cloud'?'ice':s.profile.type)));
    }
    const indices=geo.index.array,groups=[[],[],[],[],[]];
    for(let i=0;i<indices.length;i+=3){
      const ids=[indices[i],indices[i+1],indices[i+2]];
      const x=ids.reduce((sum,j)=>sum+uv.getX(j)*12,0)/3,z=ids.reduce((sum,j)=>sum+uv.getY(j)*12,0)/3;
      if(Math.hypot(x,z)>this.extent*.48)continue;
      const t=types[ids[0]]===types[ids[1]]?types[ids[0]]:types[ids[2]];
      groups[t].push(...ids);
    }
    geo.clearGroups();const joined=[];
    for(let i=0;i<groups.length;i++){geo.addGroup(joined.length,groups[i].length,i);for(const index of groups[i])joined.push(index);}
    geo.setIndex(joined);geo.setAttribute('edgeWeight',new THREE.BufferAttribute(edgeWeights,1));geo.setAttribute('basePosition',new THREE.BufferAttribute(basePositions,3));geo.setAttribute('globeUv',new THREE.BufferAttribute(globeUVs,2));geo.setAttribute('surfacePoint',new THREE.BufferAttribute(detailPoints,3));geo.computeVertexNormals();return geo;
  }
}
