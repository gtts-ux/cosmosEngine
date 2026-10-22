import test from 'node:test';
import assert from 'node:assert/strict';
import {BODIES} from '../src/data/catalog.js';
import {populateWorlds} from '../src/data/world-population.js';
import {positionsAt,J2000} from '../src/physics/orbits.js';
import {hostStarId} from '../src/data/systems.js';
test('all nearby stars have deterministic planets and stable parented moons without saving generated maps',()=>{
 const bodies=populateWorlds(BODIES),planets=bodies.filter(b=>b.kind==='Planet'),moons=bodies.filter(b=>b.generatedMoon);
 assert.equal(planets.length,55*4);assert.ok(moons.length>100);assert.deepEqual(populateWorlds(BODIES),bodies);
 const all=[...BODIES,...bodies],byId=Object.fromEntries(all.map(b=>[b.id,b])),positions=positionsAt(all,J2000);
 for(const b of bodies){assert.ok(positions[b.id].every(Number.isFinite));assert.notEqual(hostStarId(b,byId),'sun');}
 for(const moon of moons){const parent=byId[moon.parent],star=byId[parent.parent],hill=parent.orbit[0]*(1-parent.orbit[1])*Math.cbrt(parent.mass/(3*star.mass));assert.ok(moon.orbit[0]<=hill*.32);assert.ok(moon.orbit[0]>parent.radius*3);assert.ok(moon.radius<parent.radius*.2);}
});
test('existing recipes keep their ids and replace only the occupied default slot',()=>{
 const custom=[{hostId:'proxima-centauri',index:0,seed:'old-world',type:'ocean',name:'Old world'}],worlds=populateWorlds(BODIES,custom),planets=worlds.filter(b=>b.kind==='Planet');
 assert.equal(planets.length,220);assert.ok(planets.some(b=>b.id==='generated-proxima-centauri-old-world-0'&&!b.automatic));assert.equal(planets.filter(b=>b.parent==='proxima-centauri'&&b.automatic).length,3);
});
