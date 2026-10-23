import {gunzipSync} from 'node:zlib';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {GALAXIES,galaxyAt,galaxyWorld,detailRadius,sectorStars,starsWithin,BLACK_HOLES} from '../src/data/galaxies.js';
import {installElevation,surveyHeight} from '../src/data/elevation.js';import {surfaceDirection} from '../src/data/geography.js';import {canLand} from '../src/data/shapes.js';
test('10 ly sectors populate every galaxy, Solar neighborhood and intergalactic space deterministically',()=>{
 assert.equal(galaxyAt([0,0,0]).id,'milky-way');assert.deepEqual(['low','medium','high'].map(detailRadius),[10,10,10]);
 const centers=[[0,0,0],[1e8,1e8,1e8],...GALAXIES.map(g=>galaxyWorld(g,[g.radius*.5,0,0]))];
 for(const p of centers){const stars=sectorStars(p);assert.ok(stars.length>0&&stars.length<100);assert.deepEqual(stars,sectorStars(p));assert.equal(starsWithin(stars,p).length,stars.length);}
});
test('moving and crossing galaxy edges preserves shared stars and generates new local stars',()=>{
 for(const p of [[0,0,0],[1e8,1e8,1e8],galaxyWorld(GALAXIES[1],[GALAXIES[1].radius-2,0,0])]){
  const next=p.map((v,i)=>v+(i===0?5:0)),a=sectorStars(p),b=sectorStars(next),byId=new Map(b.map(s=>[s.id,s]));
  const shared=starsWithin(a,next);assert.ok(shared.length>0);for(const star of shared)assert.deepEqual(byId.get(star.id),star);
  assert.ok(b.some(star=>!a.some(old=>old.id===star.id)));assert.deepEqual(sectorStars(p),a);
 }
 assert.deepEqual(sectorStars([Infinity,0,0]),[]);assert.deepEqual(sectorStars([0,0,0],1e9),[]);
});
test('black holes have Schwarzschild sizes and no landing surface',()=>{for(const b of BLACK_HOLES){assert.equal(canLand(b),false);assert.ok(Math.abs(b.radius/(b.mass/1.9885e30)-2.95325)<1e-8);}});
test('Mars MOLA elevations locate Olympus Mons, Hellas and northern plains; Earth relief follows geography',async()=>{
 for(const id of ['earth','mars']){const b=gunzipSync(await readFile(`assets/data/${id}-elevation.bin.gz`));installElevation(id,new Int16Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)));}
 const h=(id,lat,lon)=>surveyHeight(id,surfaceDirection(lat,lon));
 assert.ok(h('mars',18.65,-133.8)>17000);assert.ok(h('mars',-42.4,70.5)<-5000);assert.ok(h('mars',60,0)<0);
 assert.ok(h('earth',29,86)>4000);assert.equal(h('earth',0,-140),0);assert.ok(h('earth',29,30)<500);
 for(const id of ['earth','mars'])assert.ok(Math.abs(h(id,20,179.999999)-h(id,20,-179.999999))<.1);
});
