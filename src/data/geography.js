// Matches Three.js SphereGeometry UVs and north-up equirectangular images.
export function surfaceCoordinates([x,y,z]) {
  const r=Math.hypot(x,y,z)||1;
  const u=((Math.atan2(z,-x)/(2*Math.PI))%1+1)%1;
  const v=Math.acos(Math.max(-1,Math.min(1,y/r)))/Math.PI;
  return {u,v,latitude:90-v*180,longitude:u*360-180};
}
export function surfaceDirection(latitude,longitude) {
  const phi=(longitude+180)*Math.PI/180,theta=(90-latitude)*Math.PI/180;
  return [-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta)];
}
export function earthBiome([r,g,b]) {
  // Classification follows the installed global albedo map, never a random site.
  if(b>r*1.16&&b>g*1.04)return 'water';
  if(Math.min(r,g,b)>172&&Math.max(r,g,b)-Math.min(r,g,b)<42)return 'ice';
  if(r>g*1.08&&g>b*1.12&&r>90)return 'sand';
  if(g>r*.94&&g>b*1.08)return 'grass';
  return 'rock';
}
export const MIN_ZOOM=.5,MAX_ZOOM=1000;
export function telescopeZoom(current,delta){return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current*Math.exp(-delta*.004)));}
export function surfaceVisible(altitude,extent,ready,warping=false){return ready&&!warping&&altitude<extent*.3;}
