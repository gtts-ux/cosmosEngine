import {gunzipSync} from 'node:zlib';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {GALAXIES,galaxyAt,galaxyWorld,detailRadius,sectorStars,BLACK_HOLES} from '../src/data/galaxies.js';
import {installElevation,surveyHeight} from '../src/data/elevation.js';import {surfaceDirection} from '../src/data/geography.js';import {canLand} from '../src/data/shapes.js';
test('galaxy sectors stay bounded, deterministic and nested across quality levels',()=>{
 assert.equal(galaxyAt([0,0,0]).id,'milky-way');assert.deepEqual(['low','medium','high'].map(detailRadius),[10,20,50]);
 for(const g of GALAXIES){const p=galaxyWorld(g,[g.radius*.5,0,0]),low=sectorStars(p,10),medium=sectorStars(p,20),high=sectorStars(p,50);assert.ok(low.length>0&&high.length<6000,g.id);assert.ok(high.length>medium.length&&medium.length>low.length);const ids=new Set(high.map(b=>b.id));assert.ok(medium.every(b=>ids.has(b.id)));assert.deepEqual(low,sectorStars(p,10));for(const b of high)assert.ok(Math.hypot(...b.anchor.map((v,i)=>v/9.4607304725808e12-p[i]))<=50.000001);}
 assert.deepEqual(sectorStars([1e8,1e8,1e8],50),[]);
});
test('black holes have Schwarzschild sizes and no landing surface',()=>{for(const b of BLACK_HOLES){assert.equal(canLand(b),false);assert.ok(Math.abs(b.radius/(b.mass/1.9885e30)-2.95325)<1e-8);}});
test('Mars MOLA elevations locate Olympus Mons, Hellas and northern plains; Earth relief follows geography',async()=>{
 for(const id of ['earth','mars']){const b=gunzipSync(await readFile(`assets/data/${id}-elevation.bin.gz`));installElevation(id,new Int16Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)));}
 const h=(id,lat,lon)=>surveyHeight(id,surfaceDirection(lat,lon));
 assert.ok(h('mars',18.65,-133.8)>17000);assert.ok(h('mars',-42.4,70.5)<-5000);assert.ok(h('mars',60,0)<0);
 assert.ok(h('earth',29,86)>4000);assert.equal(h('earth',0,-140),0);assert.ok(h('earth',29,30)<500);
 for(const id of ['earth','mars'])assert.ok(Math.abs(h(id,20,179.999999)-h(id,20,-179.999999))<.1);
});
