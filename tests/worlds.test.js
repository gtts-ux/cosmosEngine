import test from 'node:test';
import assert from 'node:assert/strict';
import {BODIES,BY_ID} from '../src/data/catalog.js';
import {shapeFactor,canLand,approachScale} from '../src/data/shapes.js';
import {verticalTransmission} from '../src/data/atmospheres.js';
test('gas and ice giants and the Sun are never landable',()=>{
 for(const id of ['sun','jupiter','saturn','uranus','neptune'])assert.equal(canLand(BY_ID[id]),false);
 for(const id of ['earth','venus','titan','deimos','pan','pluto'])assert.equal(canLand(BY_ID[id]),true);
});
test('irregular bodies preserve physical radius and have stable directional shapes',()=>{
 assert.equal(BY_ID.deimos.radius,6.2);
 for(const body of BODIES.filter(b=>b.axes)){
  const factors=[[1,0,0],[0,1,0],[0,0,1],[1,1,1],[-1,0,0]].map(d=>shapeFactor(body,d));
  for(const f of factors)assert.ok(Number.isFinite(f)&&f>.3&&f<2.3,body.id);
  assert.ok(Math.max(...factors)-Math.min(...factors)>.1,body.id);
 }
 assert.equal(shapeFactor(BY_ID.earth,[1,0,0]),1);
 assert.ok(approachScale(BY_ID.deimos)>15);
});
test('new inner Jovian and Saturnian moons have valid parents and approximate orbits',()=>{
 for(const id of ['metis','adrastea','amalthea','thebe','pan','daphnis','atlas','prometheus','pandora','epimetheus','janus','hyperion']){
  const b=BY_ID[id];assert.ok(b&&b.radius>0&&b.axes&&b.period>0);assert.ok(b.orbit[0]>BY_ID[b.parent].radius*1.5);assert.equal(b.kind,'Natural satellite');
 }
 assert.equal(new Set(BODIES.map(b=>b.id)).size,BODIES.length);
});
test('thick atmospheres obscure space and thin atmospheres retain transmission',()=>{
 for(const id of ['venus','titan','saturn','jupiter']){assert.ok(verticalTransmission(id,100)<.001);assert.ok(verticalTransmission(id,1e7)>.99);}
 assert.ok(verticalTransmission('mars',0)>.9);assert.equal(verticalTransmission('deimos'),1);
});
