export const sphereVertex = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPoint;
  varying vec3 vLocal;
  void main() {
    vUv = uv; vLocal = normalize(position);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vPoint = (modelMatrix * vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    #include <logdepthbuf_vertex>
  }
`;
export const surfaceLighting = `  uniform sampler2D dayMap, nightMap, normalMap, specMap;
  uniform vec3 detailCenter;uniform float detailCut;
  uniform vec3 sunDirection, atmosphereColor, ringNormal, center, occluder;
  uniform float hasNight, hasNormal, hasSpecular, hasAtmosphere, radius, ringOuter, shadowEnabled, occluderRadius,cloudBoundary,oceanWorld;
  vec3 mappedNormal(vec3 n,vec2 surfaceUV,vec3 point) {
    vec3 q0=dFdx(point),q1=dFdy(point);
    vec2 st0=dFdx(surfaceUV),st1=dFdy(surfaceUV);
    vec3 q1p=cross(q1,n),q0p=cross(n,q0);
    vec3 T=q1p*st0.x+q0p*st1.x, B=q1p*st0.y+q0p*st1.y;
    float scale=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-16));
    vec3 mapN=texture2D(normalMap,surfaceUV).xyz*2.0-1.0;
    mapN.xy*=0.45;
    return normalize(mat3(T*scale,B*scale,n)*mapN);
  }
vec3 orbitalColor(vec2 surfaceUV,vec3 geoNormal,vec3 point){
    vec3 geometric=normalize(geoNormal);
    vec3 n=hasNormal>0.5?mappedNormal(geometric,surfaceUV,point):geometric;
    vec3 L=normalize(sunDirection), V=normalize(cameraPosition-point);
    float ndl=dot(n,L);
    float light=max(ndl,0.0), shadow=1.0;
    if(shadowEnabled>0.5 && ringOuter>0.0) {
      float denom=dot(L,ringNormal);
      float t=-dot(point-center,ringNormal)/(abs(denom)>0.001?denom:0.001);
      float r=length(point-center+L*t)/radius;
      if(t>0.0 && r>1.25 && r<ringOuter) {
        float cassini=smoothstep(1.93,1.96,r)*(1.0-smoothstep(2.0,2.025,r));
        shadow=mix(0.23,0.95,cassini);
      }
    }
    if(shadowEnabled>0.5 && occluderRadius>0.0) {
      vec3 toMoon=occluder-point;
      float along=dot(toMoon,L);
      float miss=length(toMoon-L*along);
      if(along>0.0)shadow*=smoothstep(occluderRadius*.93,occluderRadius*1.08,miss);
    }
    vec3 day=texture2D(dayMap,surfaceUV).rgb;
    vec3 color=day*(0.012+light*1.65*shadow);
    float night=(1.0-smoothstep(-0.12,0.12,dot(geometric,L)));
    color+=texture2D(nightMap,surfaceUV).rgb*night*hasNight*2.2;
    float spec=pow(max(dot(reflect(-L,n),V),0.0),75.0);
    float ocean=oceanWorld>.5?step(day.r*1.8,day.b)*step(day.g*1.05,day.b):texture2D(specMap,surfaceUV).r;
    color+=vec3(1.0,.94,.84)*spec*ocean*hasSpecular*light*.8*shadow;
    float seaFresnel=.035+.965*pow(1.0-max(dot(n,V),0.0),5.0);
    vec3 seaSky=mix(vec3(.13,.29,.48),vec3(.62,.78,.85),pow(1.0-abs(dot(reflect(-V,n),geometric)),2.0));
    color=mix(color,seaSky*(.04+light*.9),ocean*hasSpecular*seaFresnel*.8);
    float rim=pow(1.0-max(dot(geometric,V),0.0),3.5);
    color+=atmosphereColor*rim*pow(max(dot(geometric,L)+.2,0.0),.7)*hasAtmosphere*.5;
return color;
}
`;
export const surfaceFragment = `
#include <common>
#include <logdepthbuf_pars_fragment>
${surfaceLighting}
uniform float detailBlend;
varying vec2 vUv;varying vec3 vNormal,vPoint,vLocal;
void main(){
 #include <logdepthbuf_fragment>
 float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
 if(cloudBoundary<threshold)discard;
 float coverage=detailCut>0.0?(1.0-smoothstep(.27,.47,length(normalize(vLocal)-detailCenter)/detailCut))*detailBlend:0.0;
 if(coverage>threshold)discard;
 gl_FragColor=vec4(orbitalColor(vUv,vNormal,vPoint),1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const atmosphereFragment = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection, atmosphereColor;
  uniform float strength;
  varying vec3 vNormal,vPoint;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 n=normalize(vNormal),v=normalize(cameraPosition-vPoint),l=normalize(sunDirection);
    float rim=pow(1.0-abs(dot(n,v)),3.0);
    float daylight=smoothstep(-.22,.4,dot(n,l));
    float mu=dot(v,l);
    float rayleigh=.75*(1.0+mu*mu);
    float g=.76;
    float mie=(1.0-g*g)/(12.566*pow(max(1.0+g*g-2.0*g*mu,.01),1.5));
    vec3 scatter=atmosphereColor*rayleigh+vec3(1.0,.73,.42)*mie*.24;
    gl_FragColor=vec4(scatter*rim*daylight*strength, rim*daylight*.65);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
export const cloudFragment = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main(){
    #include <logdepthbuf_fragment>
    float cloud=texture2D(cloudMap,vUv).r;
    float light=max(dot(normalize(vNormal),normalize(sunDirection)),0.0);
    gl_FragColor=vec4(vec3(.98,.99,1.0)*(.018+light*1.45),smoothstep(.2,.9,cloud)*.83);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
// Compact 3D simplex noise, based on Stefan Gustavson / Ashima Arts (MIT).
export const simplex = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 invsqrt4(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
 const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0,.5,1,2);
 vec3 i=floor(v+dot(v,C.yyy)),x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz),l=1.0-g,i1=min(g.xyz,l.zxy),i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx,x2=x0-i2+C.yyy,x3=x0-D.yyy;i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
 float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;
 vec4 j=p-49.0*floor(p*ns.z*ns.z),x_=floor(j*ns.z),y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy,y=y_*ns.x+ns.yyyy,h=1.0-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw),s0=floor(b0)*2.0+1.0,s1=floor(b1)*2.0+1.0,sh=-step(h,vec4(0));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x),p1=vec3(a0.zw,h.y),p2=vec3(a1.xy,h.z),p3=vec3(a1.zw,h.w);
 vec4 norm=invsqrt4(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
 p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m*=m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
export const sunFragment = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float time,stellarBlend;uniform vec3 stellarTint;
  uniform sampler2D dayMap;
  varying vec2 vUv;
  varying vec3 vLocal,vNormal,vPoint;
  ${simplex}
  void main(){
    #include <logdepthbuf_fragment>
    float n=snoise(vLocal*22.0+vec3(time*.03));
    float fine=snoise(vLocal*80.0-vec3(time*.05));
    float limb=pow(max(dot(normalize(vNormal),normalize(cameraPosition-vPoint)),0.0),.3);
    vec3 map=texture2D(dayMap,vUv).rgb;
    vec3 color=mix(vec3(1.0,.62,.24),stellarTint,stellarBlend)*(1.15+n*.12+fine*.06)*(map.r*.6+.4)*(.75+limb*.25);
    // Body-fixed active regions: dark umbrae inside softer penumbrae.
    vec3 d=normalize(vLocal);float spot=0.0;
    for(int i=0;i<14;i++){
      float k=float(i),longitude=k*2.399963,latitude=sin(k*7.13)*.43;
      vec3 C=vec3(cos(latitude)*cos(longitude),sin(latitude),cos(latitude)*sin(longitude));
      float r=.021+.013*(.5+.5*sin(k*13.7));float dist=length(d-C);
      float edge=1.0-smoothstep(r*.7,r*1.65,dist);
      float core=1.0-smoothstep(r*.35,r*.8,dist);
      spot=max(spot,edge*.5+core*.46);
    }
    color*=1.0-spot;
    gl_FragColor=vec4(color,1);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
export const ringFragment = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunLocal, tint;
  uniform float outer, shadowEnabled;
  varying vec3 vLocal;
  void main(){
    #include <logdepthbuf_fragment>
    float r=length(vLocal.xy);
    float band=.7+.12*sin(r*190.0)+.1*sin(r*523.0)+.08*sin(r*41.0);
    float gap=1.0-smoothstep(1.92,1.96,r)*(1.0-smoothstep(2.0,2.03,r));
    float edge=smoothstep(1.22,1.3,r)*(1.0-smoothstep(outer-.05,outer,r));
    vec3 point=vec3(vLocal.x,0.0,-vLocal.y);
    vec3 l=normalize(sunLocal);
    float along=dot(-point,l);
    float miss=length(point+l*along);
    float shade=shadowEnabled>.5&&along>0.0?mix(.12,1.0,smoothstep(.94,1.04,miss)):1.0;
    gl_FragColor=vec4(tint*(.4+band*.6)*shade,edge*band*gap*.82);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// High-frequency structure comes from licensed planetary imagery; seeded advection
// varies fictional giants without reducing their clouds to flat noise bands.
export const gasFragment=surfaceFragment.replace('uniform vec3 sunDirection,','uniform float gasSeed,time,gasVariant;uniform vec3 gasTint;\n  uniform vec3 sunDirection,').replace('void main() {',simplex+'\nvoid main() {').replace('0.012+light*1.65*shadow','0.018+light*1.1*shadow').replace('vec3 day=texture2D(dayMap,vUv).rgb;',`
    vec3 p=normalize(vLocal);vec2 cloudUV=vUv;
    if(gasVariant>.5){
      float curl=snoise(p*19.0+vec3(gasSeed*.013+time*.006));
      float eddies=sin(p.y*53.0+p.z*31.0+curl*3.0+time*.008);
      vec2 sourceUV=vec2(vUv.x+gasSeed*.618033,mix(vUv.y,1.0-vUv.y,step(500.0,gasSeed)));
      // Let the sampler wrap longitude; fract here introduces a false mip seam.
      cloudUV=vec2(sourceUV.x+sin(p.y*12.0)*time*.00006+curl*.003,clamp(sourceUV.y+curl*.0018+eddies*.0007,.001,.999));
    }else cloudUV.x+=sin(p.y*12.0)*time*.00001;
    vec3 day=texture2D(dayMap,cloudUV).rgb;
    vec3 tint=gasTint/max(dot(gasTint,vec3(.299,.587,.114)),.05);
    day*=mix(vec3(1.0),tint,gasVariant*.12);
`);
