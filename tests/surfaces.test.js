import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES,BY_ID,TEXTURES } from '../src/data/catalog.js';
import { GROUND_TEXTURES,GAS_GIANTS,surfaceProfile,terrainHeight,terrainExtent,seedFor } from '../src/data/surfaces.js';
test('every landable body has a valid finite terrain model',()=>{
  for(const b of BODIES.filter(b=>b.id!=='sun')){
    const p=surfaceProfile(b),seed=seedFor(b.id);assert.ok(p.type&&p.title);assert.ok(p.relief>=0);
    const extent=terrainExtent(b);assert.ok(extent>0&&extent<=64000);
    for(const [x,z] of [[0,0],[37,-120],[-extent/3,extent/3]])assert.ok(Number.isFinite(terrainHeight(x,z,p,seed)),b.id);
  }
});
test('Earth biomes and gas giant cloud tops are distinct',()=>{
  assert.equal(surfaceProfile(BY_ID.earth,'grass').type,'grass');assert.equal(surfaceProfile(BY_ID.earth,'sand').type,'sand');
  assert.equal(surfaceProfile(BY_ID.earth,'water').type,'water');
  for(const id of GAS_GIANTS)assert.equal(surfaceProfile(BY_ID[id]).type,'cloud');
  assert.equal(surfaceProfile(BY_ID.titan).type,'sand');assert.equal(surfaceProfile(BY_ID.io).type,'volcanic');
});
test('Pluto and all five dwarf planets are searchable with physical scales',()=>{
  for(const id of ['ceres','pluto','eris','haumea','makemake'])assert.equal(BY_ID[id].kind,'Dwarf planet');
  assert.equal(BY_ID.charon.parent,'pluto');assert.equal(BY_ID.pluto.radius,1188.3);
  assert.ok(BY_ID.pluto.orbit[1]>.24&&BY_ID.pluto.orbit[1]<.26);
});
test('material maps are allowlisted and seed/terrain generation repeat exactly',()=>{
  for(const name of GROUND_TEXTURES)assert.ok(TEXTURES.includes(name));
  assert.equal(seedFor('europa'),seedFor('europa'));assert.notEqual(seedFor('europa'),seedFor('titan'));
  const p=surfaceProfile(BY_ID.moon),seed=seedFor('moon');assert.equal(terrainHeight(10,20,p,seed),terrainHeight(10,20,p,seed));
});
