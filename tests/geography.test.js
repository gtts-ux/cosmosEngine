import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceCoordinates,surfaceDirection,earthBiome,telescopeZoom,surfaceVisible} from '../src/data/geography.js';
test('globe coordinates round trip across poles and longitude seam',()=>{
  for(const lat of [-90,-75,0,48,89,90])for(const lon of [-180,-179,0,20,179]){
    const c=surfaceCoordinates(surfaceDirection(lat,lon));assert.ok(Math.abs(c.latitude-lat)<1e-6);
    if(Math.abs(lat)<90)assert.ok(Math.abs(c.longitude-lon)<1e-6);
  }
});
test('actual map albedo distinguishes ocean, desert, vegetation and ice',()=>{
  for(const [rgb,type] of [[[15,35,95],'water'],[[190,160,110],'sand'],[[60,90,50],'grass'],[[220,225,230],'ice'],[[90,85,85],'rock']])assert.equal(earthBiome(rgb),type);
});
test('terrain visibility follows proximity and readiness in any navigation mode',()=>{
  assert.equal(surfaceVisible(5,24000,true),true);assert.equal(surfaceVisible(5000,24000,true),true);
  assert.equal(surfaceVisible(50000,24000,true),false);assert.equal(surfaceVisible(5,24000,false),false);assert.equal(surfaceVisible(5,24000,true,true),false);
});
test('telescope zoom has exact bounds and reversible scale',()=>{
  assert.equal(telescopeZoom(1,-1e6),1000);assert.equal(telescopeZoom(1,1e6),.5);
  assert.ok(Math.abs(telescopeZoom(telescopeZoom(1,-100),100)-1)<1e-12);
});
