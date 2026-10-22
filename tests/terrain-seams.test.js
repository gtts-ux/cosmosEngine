import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {TerrainBuilder} from '../src/render/terrain-builder.js';
import {SurfaceAtlas} from '../src/render/geography.js';import {shapeFactor} from '../src/data/shapes.js';
import {BY_ID} from '../src/data/catalog.js';
test('terrain boundary lies on the same triangulated surface as the globe',()=>{
 const atlas={width:2,height:1,data:new Uint8ClampedArray([100,95,90,255,100,95,90,255])};
 for(const id of ['earth','mars','deimos']){
  const body=BY_ID[id],builder=new TerrainBuilder({body,direction:[1,0,0],extent:64000,atlas,globeSegments:96}),sphere=new THREE.SphereGeometry(1,96,48),pos=sphere.attributes.position;
  for(let i=0;i<pos.count;i++){const d=new THREE.Vector3().fromBufferAttribute(pos,i).normalize(),r=body.radius*1000*shapeFactor(body,d.toArray())+builder.atlas.macro(body,d);pos.setXYZ(i,d.x*r,d.y*r,d.z*r);}
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
  for(const values of [[1,.07,.05],[.1,1,-.03],[1,.002,-.002]]){
   const d=new THREE.Vector3(...values).normalize(),ray=new THREE.Ray(new THREE.Vector3(),d);let expected=null;
   for(let i=0;i<sphere.index.count;i+=3){a.fromBufferAttribute(pos,sphere.index.getX(i));b.fromBufferAttribute(pos,sphere.index.getX(i+1));c.fromBufferAttribute(pos,sphere.index.getX(i+2));if(ray.intersectTriangle(a,b,c,false,hit)){expected=hit.clone();break;}}
   assert.ok(expected);assert.ok(builder.globePoint(d).distanceTo(expected)<1,id);
  }
 }
});
