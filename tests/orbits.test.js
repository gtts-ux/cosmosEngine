import test from 'node:test';
import assert from 'node:assert/strict';
import { solveKepler,wrapRadians,positionsAt,positionFromElements,toJulian,fromJulian,SimulationClock,AU,J2000,MIN_JD,MAX_JD } from '../src/physics/orbits.js';
import { BODIES } from '../src/data/catalog.js';
import { sanitizeSettings,defaults } from '../electron/settings.js';
test('Julian epoch and UTC roundtrip',()=>{
  assert.equal(toJulian(Date.parse('2000-01-01T12:00:00Z')),J2000);
  assert.equal(fromJulian(J2000).toISOString(),'2000-01-01T12:00:00.000Z');
});
test('Kepler residual including near-parabolic eccentricity and many revolutions',()=>{
  for(const e of [0,.0167,.2056,.9,.99]) for(const M of [-1000,-3,-.1,0,.1,2,1000]) {
    const E=solveKepler(M,e);
    assert.ok(Math.abs(E-e*Math.sin(E)-wrapRadians(M))<1e-10);
  }
});
test('ellipse periapsis, apoapsis, and inclination',()=>{
  const el=[10,.2,0,0,0,0];
  assert.deepEqual(positionFromElements(el,0),[8,0,-0]);
  assert.ok(Math.abs(Math.hypot(...positionFromElements(el,Math.PI))-12)<1e-10);
  assert.ok(positionFromElements([10,0,90,90,0,0])[1]>9.99);
});
test('J2000 Earth barycenter matches JPL example coordinates',()=>{
  const p=positionsAt(BODIES,J2000);
  const e=BODIES.find(b=>b.id==='earth'),m=BODIES.find(b=>b.id==='moon');
  const bary=p.earth.map((v,i)=>(v*e.mass+p.moon[i]*m.mass)/(e.mass+m.mass)/AU);
  assert.ok(Math.abs(bary[0]-(-.17717125))<.0001);
  assert.ok(Math.abs(bary[2]-(-.96721448))<.0001);
  assert.ok(Math.hypot(...p.moon.map((v,i)=>v-p.earth[i]))>350000);
  assert.ok(Math.hypot(...p.moon.map((v,i)=>v-p.earth[i]))<410000);
});
test('all bodies finite throughout supported interval',()=>{
  for(const jd of [MIN_JD,J2000,MAX_JD]) {
    const p=positionsAt(BODIES,jd);
    for(const b of BODIES) assert.ok(p[b.id].every(Number.isFinite),b.id);
  }
});
test('time supports pause, reverse, sub-real-time, limits, reset',()=>{
  const c=new SimulationClock(Date.parse('2000-01-01T12:00:00Z'));
  c.setRate(86400);c.step(1);assert.equal(c.jd,J2000+1);
  c.setRate(-86400);c.step(1);assert.equal(c.jd,J2000);
  c.paused=true;c.step(10);assert.equal(c.jd,J2000);
  c.paused=false;c.setRate(.1);c.step(86400);assert.equal(c.jd,J2000+.1);
  c.jd=MAX_JD;c.setRate(1e9);c.step(1);assert.equal(c.rate,1e6);assert.equal(c.jd,MAX_JD);assert.ok(c.paused);
  c.reset();assert.equal(c.rate,1);assert.equal(c.paused,false);
});
test('settings cannot introduce paths, arbitrary keys or invalid values',()=>{
  assert.deepEqual(sanitizeSettings(null),defaults);
  const s=sanitizeSettings({quality:'impossible',stars:1e9,bloom:-2,labels:'false',path:'/tmp/x',exposure:NaN});
  assert.equal(s.quality,'medium');assert.equal(s.stars,16000);assert.equal(s.bloom,0);assert.equal(s.labels,true);assert.equal(s.path,undefined);
});
