import test from 'node:test';
import assert from 'node:assert/strict';
import {BODIES,BY_ID} from '../src/data/catalog.js';
import {mountainHeight,isGasGiant} from '../src/data/surfaces.js';
import {canLand} from '../src/data/shapes.js';
test('mountains are continuous in body coordinates, bounded for small moons and flat beneath oceans',()=>{
 for(const b of BODIES){
  for(const d of [[1,0,0],[0,1,0],[0,0,-1],[.2,.6,.7]]){
   const h=mountainHeight(b,d,'rock');assert.ok(Number.isFinite(h));assert.ok(h>=0&&h<=b.radius*1000*.012+1e-7);
   assert.ok(Math.abs(h-mountainHeight(b,d.map(x=>x*3),'rock'))<1e-7);
   assert.equal(mountainHeight(b,d,'water'),0);
  }
  const a=mountainHeight(b,[1,0,1e-9],'rock'),z=mountainHeight(b,[1,0,-1e-9],'rock');assert.ok(Math.abs(a-z)<.01,b.id);
 }
 const range=Array.from({length:200},(_,i)=>mountainHeight(BY_ID.moon,[Math.cos(i),Math.sin(i*.71),Math.sin(i)],'rock'));
 assert.ok(Math.max(...range)-Math.min(...range)>1000);
});
test('gas classification covers both catalog and generated giants, which have no solid terrain',()=>{
 for(const b of [BY_ID.jupiter,BY_ID.saturn,BY_ID.uranus,BY_ID.neptune,{id:'generated-gas',surfaceType:'gas',radius:40000}]){
  assert.ok(isGasGiant(b));assert.equal(canLand(b),false);assert.equal(mountainHeight(b,[1,0,0],'rock'),0);
 }
 assert.equal(isGasGiant(BY_ID.titan),false);assert.ok(canLand(BY_ID.titan));
});
