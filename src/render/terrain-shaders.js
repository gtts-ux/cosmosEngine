import {surfaceLighting} from './shaders.js';
export const terrainVertex=`
 #include <common>
 #include <logdepthbuf_pars_vertex>
 attribute vec3 basePosition,surfacePoint;attribute float edgeWeight;attribute vec2 globeUv;
 uniform float terrainBlend;uniform mat3 terrainToBody;
 varying float tileWeight;varying vec2 atlasUV;varying vec3 bodyCoords,bodyN,worldPoint,worldNormal;
 void main(){
  tileWeight=edgeWeight;atlasUV=globeUv;bodyCoords=surfacePoint;bodyN=normalize(terrainToBody*normal);
  vec3 point=mix(basePosition,position,terrainBlend);
  worldPoint=(modelMatrix*vec4(point,1.0)).xyz;worldNormal=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
  #include <logdepthbuf_vertex>
 }`;
export const terrainFragment=`
 #include <common>
 #include <logdepthbuf_pars_fragment>
 ${surfaceLighting}
 uniform sampler2D detailMap,detailNormalMap,roughMap;
 uniform float metersToUnits,terrainBlend,materialKind;uniform mat3 bodyToWorld;
 
 varying float tileWeight;varying vec2 atlasUV;varying vec3 bodyCoords,bodyN,worldPoint,worldNormal;
 void main(){
  #include <logdepthbuf_fragment>
  float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
  float coverage=tileWeight*terrainBlend;if(coverage<.001)discard;
  float metres=length(worldPoint-cameraPosition)/metersToUnits;
  float regional=(1.0-smoothstep(120.0,5500.0,metres))*terrainBlend*tileWeight;
  float fine=(1.0-smoothstep(25.0,900.0,metres))*terrainBlend*tileWeight;
  vec3 base=texture2D(dayMap,atlasUV).rgb;
  vec3 weights=pow(abs(normalize(bodyN)),vec3(5.0));weights/=max(dot(weights,vec3(1.0)),.001);
  vec3 uv=bodyCoords/8.0;
  // Body-fixed triplanar projection removes pole stretching and tile seams.
  vec3 photo=texture2D(detailMap,uv.yz).rgb*weights.x+texture2D(detailMap,uv.xz).rgb*weights.y+texture2D(detailMap,uv.xy).rgb*weights.z;
  float luminance=dot(photo,vec3(.299,.587,.114)),baseLum=max(dot(base,vec3(.299,.587,.114)),.025);
  vec3 palette=clamp(base/baseLum,vec3(.25),vec3(2.0));
  vec3 materialColor=materialKind<.5?vec3(luminance)*palette:mix(photo,photo*palette,.35);
  materialColor*=clamp(sqrt(baseLum/.24),.55,1.35);
  // Preserve the regional mean; only photographic contrast appears close up.
  vec3 albedo=base*clamp(materialColor/max(vec3(.035),base),vec3(.55),vec3(1.55));
  albedo=mix(base,albedo,regional*.85);
  vec3 N=normalize(worldNormal),V=normalize(cameraPosition-worldPoint),L=normalize(sunDirection);
  vec3 nx=texture2D(detailNormalMap,uv.yz).xyz*2.0-1.0,ny=texture2D(detailNormalMap,uv.xz).xyz*2.0-1.0,nz=texture2D(detailNormalMap,uv.xy).xyz*2.0-1.0;
  vec3 detailNormal=normalize(vec3(nx.z*sign(bodyN.x),nx.x,nx.y)*weights.x+vec3(ny.x,ny.z*sign(bodyN.y),ny.y)*weights.y+vec3(nz.x,nz.y,nz.z*sign(bodyN.z))*weights.z);
  N=normalize(mix(N,normalize(bodyToWorld*detailNormal),fine*.42));
  float lit=max(dot(N,L),0.0),rough=texture2D(roughMap,uv.xz).r;
  float spec=pow(max(dot(reflect(-L,N),V),0.0),mix(18.0,65.0,1.0-rough))*fine*.025;
  vec3 orbital=orbitalColor(atlasUV,worldNormal,worldPoint);
  vec3 detailed=albedo*(.012+lit*1.65)+spec;
  gl_FragColor=vec4(mix(orbital,detailed,regional),coverage);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
