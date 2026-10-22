export const AU = 149597870.7;
export const J2000 = 2451545;
export const DAY = 86400;
export const MIN_JD = 2378496.5; // 1800-01-01; JPL Table 1 validity interval
export const MAX_JD = 2469807.5; // 2050-01-01
const RAD = Math.PI / 180;
export function toJulian(ms) { return ms / 86400000 + 2440587.5; }
export function fromJulian(jd) { return new Date((jd - 2440587.5) * 86400000); }
export function wrapRadians(a) { return ((a + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI; }
export function solveKepler(mean, eccentricity) {
  const M = wrapRadians(mean);
  let E = M + eccentricity * Math.sin(M);
  for (let j = 0; j < 16; j++) {
    const delta = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-13) break;
  }
  return E;
}
export function elementsAt(body, jd) {
  if (body.elements) {
    const T = (jd-J2000)/36525;
    const el = body.elements.map((v,i)=>v + body.rates[i]*T);
    el[0] *= AU;
    return el;
  }
  if (body.orbit) {
    const el = [...body.orbit];
    el[3] += 360*(jd-J2000)/body.period;
    // First-order lunar nodal and apsidal precession; satellite phases otherwise
    // illustrative mean elements, not a high-precision satellite ephemeris.
    if (body.id === 'moon') {
      el[4] += .1114034 * (jd-J2000);
      el[5] -= .0529539 * (jd-J2000);
    }
    return el;
  }
  return null;
}
export function positionFromElements(elements, eccentricAnomaly) {
  const [a,e,inc,,peri,node] = elements;
  const I=inc*RAD, w=(peri-node)*RAD, N=node*RAD;
  const E = eccentricAnomaly ?? solveKepler((elements[3]-peri)*RAD,e);
  const x=a*(Math.cos(E)-e), y=a*Math.sqrt(1-e*e)*Math.sin(E);
  const cw=Math.cos(w),sw=Math.sin(w),cn=Math.cos(N),sn=Math.sin(N),ci=Math.cos(I),si=Math.sin(I);
  // Ecliptic X,Y,Z -> right-handed Three.js X,Z,-Y with +Y north.
  return [(cw*cn-sw*sn*ci)*x+(-sw*cn-cw*sn*ci)*y,
    sw*si*x+cw*si*y,
    -((cw*sn+sw*cn*ci)*x+(-sw*sn+cw*cn*ci)*y)];
}
export function positionsAt(bodies, jd, origin=[0,0,0]) {
  const result = {};
  for (const body of bodies) {
    const el=elementsAt(body,jd);
    const local=body.anchor?body.anchor.map((v,i)=>v-origin[i]):el?positionFromElements(el):!body.parent?origin.map(v=>-v):[0,0,0];
    const parent=result[body.parent] || [0,0,0];
    result[body.id]=local.map((v,i)=>v+parent[i]);
  }
  // JPL Earth elements describe the Earth-Moon barycenter. Offset both members
  // so their mass-weighted barycenter stays at the tabulated position.
  if (result.earth && result.moon) {
    const earth=bodies.find(b=>b.id==='earth'), moon=bodies.find(b=>b.id==='moon');
    const ratio=moon.mass/(earth.mass+moon.mass);
    const offset=result.moon.map((v,i)=>(v-result.earth[i])*ratio);
    result.earth=result.earth.map((v,i)=>v-offset[i]);
    result.moon=result.moon.map((v,i)=>v-offset[i]);
  }
  return result;
}
export function sampleOrbit(body,jd,segments=256) {
  const el=elementsAt(body,jd);
  return el?Array.from({length:segments+1},(_,i)=>positionFromElements(el,i/segments*Math.PI*2)):[];
}
export class SimulationClock {
  constructor(ms=Date.now()) { this.jd=Math.max(MIN_JD,Math.min(MAX_JD,toJulian(ms)));this.rate=1;this.paused=false;this.atBoundary=false; }
  step(seconds) {
    if(this.paused) return;
    const next=this.jd+seconds*this.rate/DAY;
    this.jd=Math.max(MIN_JD,Math.min(MAX_JD,next));
    this.atBoundary=next<MIN_JD||next>MAX_JD;
    if(this.atBoundary) this.paused=true;
  }
  setRate(rate) { if(Number.isFinite(rate))this.rate=Math.max(-1e6,Math.min(1e6,rate)); }
  reset() { this.jd=toJulian(Date.now());this.rate=1;this.paused=false;this.atBoundary=false; }
}
