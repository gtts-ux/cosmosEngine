import test from 'node:test';
import assert from 'node:assert/strict';
import {BODIES,BY_ID} from '../src/data/catalog.js';
import {NEARBY_STARS} from '../src/data/nearby-stars.js';
import {isStar,hostStarId,bodiesInSystem,currentSystem,generatePlanet,sanitizeWorlds,restorePlanets} from '../src/data/systems.js';
import {canLand} from '../src/data/shapes.js';
import {positionsAt,elementsAt,positionFromElements,J2000} from '../src/physics/orbits.js';
test('55 real nearby catalog stars are spatially distinct and non-landable',()=>{
 assert.equal(NEARBY_STARS.length,55);assert.equal(BODIES.filter(isStar).length,56);assert.ok(BY_ID['proxima-centauri']);
 for(const s of NEARBY_STARS){assert.ok(s.anchor.every(Number.isFinite));assert.ok(s.distanceLY>4&&s.distanceLY<20);assert.equal(canLand(s),false);assert.ok(s.radius>0&&s.mass>0);}
 assert.equal(new Set(BODIES.map(b=>b.id)).size,BODIES.length);
});
test('generated planets repeat from recipes and orbit their selected star',()=>{
 const star=BY_ID['proxima-centauri'];
 for(const type of ['rocky','ocean','ice','gas','random']){
  const d={seed:'world-42',index:0,type},a=generatePlanet(star,d),b=generatePlanet(star,d);
  assert.deepEqual(a,b);assert.equal(a.parent,star.id);assert.ok(a.period>0&&a.radius>0&&a.mass>0);assert.equal(canLand(a),a.surfaceType!=='gas');
  const p=positionsAt([star,a],J2000,star.anchor),exact=positionFromElements(elementsAt(a,J2000));
  assert.ok(p[star.id].every(v=>v===0));assert.ok(Math.hypot(...p[a.id].map((v,i)=>v-exact[i]))<1e-9,'system-local coordinates preserve sub-metre precision');
 }
 assert.notEqual(generatePlanet(star,{seed:'one',index:0,type:'rocky'}).mass,generatePlanet(star,{seed:'two',index:0,type:'rocky'}).mass);
});
test('system catalogs and physical system detection remain separate from inspection',()=>{
 const star=BY_ID['proxima-centauri'],planet=generatePlanet(star,{seed:'test',index:0,type:'ocean'}),all=[...BODIES,planet],map=Object.fromEntries(all.map(b=>[b.id,b]));
 assert.equal(hostStarId(BY_ID.europa,map),'sun');assert.equal(hostStarId(planet,map),star.id);
 assert.deepEqual(bodiesInSystem(all,star.id).map(b=>b.id),[star.id,planet.id]);
 assert.equal(currentSystem([0,0,0],all.filter(isStar)),'sun');assert.equal(currentSystem(star.anchor,all.filter(isStar)),star.id);assert.equal(currentSystem([1e17,1e17,1e17],all.filter(isStar)),null);
});
test('saved generation data rejects invalid hosts, paths, duplicate slots and arbitrary fields',()=>{
 const valid={hostId:'proxima-centauri',seed:'safe',type:'ice',index:0,name:'World'};
 const state=sanitizeWorlds({version:1,planets:[valid,{...valid,name:'duplicate'},{...valid,index:1,seed:'../../x'},{...valid,index:2,hostId:'earth'},{...valid,index:99},{...valid,index:3,type:'script'}]},BODIES);
 assert.deepEqual(state.planets,[valid]);assert.deepEqual(restorePlanets(state,BODIES),[generatePlanet(BY_ID['proxima-centauri'],valid)]);
 assert.deepEqual(sanitizeWorlds({version:99,planets:[valid]},BODIES),{version:1,planets:[]});
});
