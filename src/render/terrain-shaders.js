export const terrainVertex=`
 #include <common>
 #include <logdepthbuf_pars_vertex>
 attribute vec3 basePosition;attribute vec2 globeUv;
 uniform float terrainBlend;
 varying vec2 atlasUV,detailUV;varying vec3 worldPoint,worldNormal;
 void main(){
  atlasUV=globeUv;detailUV=uv;
  vec3 point=mix(basePosition,position,terrainBlend);
  worldPoint=(modelMatrix*vec4(point,1.0)).xyz;worldNormal=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
  #include <logdepthbuf_vertex>
 }`;
export const terrainFragment=`
 #include <common>
 #include <logdepthbuf_pars_fragment>
 uniform sampler2D dayMap,detailMap,normalMap,roughMap;
 uniform float metersToUnits,terrainBlend;
 uniform vec3 sunDirection;
 varying vec2 atlasUV,detailUV;varying vec3 worldPoint,worldNormal;
 void main(){
  #include <logdepthbuf_fragment>
  float metres=length(worldPoint-cameraPosition)/metersToUnits;
  float regional=(1.0-smoothstep(700.0,6000.0,metres))*terrainBlend;
  float fine=(1.0-smoothstep(15.0,450.0,metres))*terrainBlend;
  vec3 base=texture2D(dayMap,atlasUV).rgb;
  float macro=dot(texture2D(detailMap,detailUV/32.0).rgb,vec3(.299,.587,.114));
  float micro=dot(texture2D(detailMap,detailUV).rgb,vec3(.299,.587,.114));
  // Global albedo remains the color source at every LOD. Detail is zero-mean luminance.
  float detail=mix(1.0,clamp(macro*2.0,.72,1.28),regional*.42);
  detail*=mix(1.0,clamp(micro*2.0,.65,1.35),fine*.55);
  vec3 N=normalize(worldNormal),V=normalize(cameraPosition-worldPoint),L=normalize(sunDirection);
  vec3 q0=dFdx(worldPoint),q1=dFdy(worldPoint);vec2 st0=dFdx(detailUV),st1=dFdy(detailUV);
  vec3 T=cross(q1,N)*st0.x+cross(N,q0)*st1.x;
  vec3 B=cross(q1,N)*st0.y+cross(N,q0)*st1.y;
  float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-16));
  vec3 bump=texture2D(normalMap,detailUV).xyz*2.0-1.0;bump.xy*=fine*.4;
  N=normalize(mat3(T*inv,B*inv,N)*bump);
  float lit=max(dot(N,L),0.0);
  float rough=texture2D(roughMap,detailUV).r;
  float spec=pow(max(dot(reflect(-L,N),V),0.0),mix(24.0,80.0,1.0-rough))*fine*.035;
  gl_FragColor=vec4(base*detail*(.012+lit*1.65)+spec,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
