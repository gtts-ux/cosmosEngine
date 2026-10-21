import * as THREE from 'three';
import { seedFor,noise2,terrainExtent,GROUND_TEXTURES } from '../data/surfaces.js';

import { SurfaceAtlas } from './geography.js';
import { surfaceVisible } from '../data/geography.js';

const upAxis=new THREE.Vector3(0,1,0);
const waterVertex=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 p,n,worldPoint;
  void main(){p=position;n=normalize(mat3(modelMatrix)*normal);worldPoint=(modelMatrix*vec4(position,1)).xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);
    #include <logdepthbuf_vertex>
  }`;
const waterFragment=`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float time,shore;uniform vec3 sunDirection,tint,up;
  varying vec3 p,n,worldPoint;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 base=normalize(n),V=normalize(cameraPosition-worldPoint),L=normalize(sunDirection);
    vec3 T=normalize(cross(abs(base.y)>.99?vec3(1,0,0):vec3(0,1,0),base)),B=cross(base,T);
    float wx=sin(p.x*.7+p.z*.21+time*1.2)*.09+sin(p.x*2.1-p.z*.4+time*2.4)*.025;
    float wz=cos(p.z*.5+p.x*.19+time*.8)*.08+sin(p.z*2.4+p.x+time*1.8)*.025;
    float bandLimit=1.0-smoothstep(.5,3.0,length(fwidth(p.xz)));wx*=bandLimit;wz*=bandLimit;
    vec3 N=normalize(base+T*wx+B*wz);
    float fresnel=.035+.965*pow(1.0-max(dot(N,V),0.0),5.0);
    float horizon=pow(1.0-abs(dot(reflect(-V,N),up)),2.0);
    vec3 sky=mix(vec3(.13,.29,.48),vec3(.62,.78,.85),horizon);
    float glint=pow(max(dot(reflect(-L,N),V),0.0),350.0)*7.0;
    vec3 color=mix(tint*(.42+max(dot(N,L),0.0)*.7),sky,fresnel*.8)+vec3(1,.91,.71)*glint;
    float foam=shore*(1.0-smoothstep(0.0,8.0,abs(p.z+75.0+sin(p.x*.13+time)*4.0)))*(.4+.6*sin(p.x*2.0+p.z*3.0)*sin(p.z*5.0-time));
    color=mix(color,vec3(.78,.87,.85),clamp(foam,0.0,.6));
    gl_FragColor=vec4(color,1);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const skyVertex=`varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1);gl_Position=p;gl_Position.z=p.w*.999999;}`;
const skyFragment=`
  #include <common>
  uniform vec3 up,sunDirection,zenith,horizon;uniform float density;
  varying vec3 direction;
  void main(){
    vec3 d=normalize(direction);float elevation=max(0.0,dot(d,up));
    vec3 col=mix(horizon,zenith,pow(elevation,.4));
    float sun=max(dot(d,sunDirection),0.0);
    col+=vec3(1,.78,.49)*pow(sun,40.0)*.12*density;
    col+=vec3(1.8,1.6,1.15)*smoothstep(.99984,.99995,sun);
    gl_FragColor=vec4(col,1);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class LandingTerrain {
  constructor(universe){
    this.universe=universe;this.atlas=new SurfaceAtlas(universe);this.root=new THREE.Group();this.root.visible=false;universe.scene.add(this.root);
    this.ambient=new THREE.HemisphereLight(0xcde6ff,0x655447,.48);this.ambient.visible=false;universe.scene.add(this.ambient);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(20,32,16),new THREE.ShaderMaterial({
      vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthTest:false,depthWrite:false,
      uniforms:{up:{value:new THREE.Vector3(0,1,0)},sunDirection:{value:new THREE.Vector3()},zenith:{value:new THREE.Color('#2465a1')},horizon:{value:new THREE.Color('#b1cbd4')},density:{value:1}},
    }));
    this.sky.frustumCulled=false;this.sky.renderOrder=-90;this.sky.visible=false;universe.scene.add(this.sky);
    this.key=null;this.ready=false;this.serial=0;this.profile=null;this.visible=false;this.error=null;
  }
  async loadMaps(){
    if(!this.mapPromise)this.mapPromise=(async()=>{
      const loader=new THREE.TextureLoader(),maps=new Map();
      await Promise.all(GROUND_TEXTURES.map(async name=>{
        const texture=await loader.loadAsync(await window.cosmos.texture(name));
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
        if(name.includes('-color'))texture.colorSpace=THREE.SRGBColorSpace;
        maps.set(name,texture);
      }));return maps;
    })().catch(error=>{this.mapPromise=null;throw error;});
    return this.mapPromise;
  }
  bodyRotation(id){const n=this.universe.nodes.get(id);return n.spin.quaternion.clone().multiply(n.mesh.quaternion);}
  localDirection(id,position){return position.clone().sub(new THREE.Vector3(...this.universe.renderPositions[id])).normalize().applyQuaternion(this.bodyRotation(id).invert());}
  sample(body,direction){return this.atlas.sample(body,direction);}
  nearest(position){
    let best=null;
    for(const body of this.universe.bodies){
      if(body.id==='sun')continue;
      const radius=this.universe.radius(body.id),factor=radius/(body.radius*1000);
      const altitude=(position.distanceTo(new THREE.Vector3(...this.universe.renderPositions[body.id]))-radius)/factor;
      if(!best||altitude<best.altitude)best={body,altitude};
    }
    return best;
  }
  async prepare(body,direction){
    if(this.loadingBody===body.id)return;
    if(this.ready&&this.body?.id===body.id&&this.anchor.angleTo(direction)*body.radius*1000<this.extent*.18)return;
    const serial=++this.serial;this.loadingBody=body.id;this.error=null;
    try{
      const maps=await this.loadMaps();if(serial!==this.serial)return;
      this.clearGeometry();this.body=body;this.anchor=direction.clone().normalize();
      this.frame=new THREE.Quaternion().setFromUnitVectors(upAxis,this.anchor);
      this.profile=this.sample(body,this.anchor).profile;this.seed=seedFor(body.id);
      this.extent=terrainExtent(body);this.radiusMeters=body.radius*1000;
      const geo=this.makeGeometry(128),materials=[];
      for(const type of ['grass','sand','rock','ice']){
        const material=new THREE.MeshStandardMaterial({color:0xffffff,map:maps.get(`ground-${type}-color.jpg`),
          normalMap:maps.get(`ground-${type}-normal.jpg`),normalScale:new THREE.Vector2(.65,.65),
          roughnessMap:maps.get(`ground-${type}-rough.jpg`),roughness:type==='ice'?.7:1,vertexColors:true});
        // Photographed rocky terrain includes moss. Treat it strictly as luminance detail;
        // all off-world chroma comes from that body's global map, never vegetation.
        material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
#ifdef USE_MAP
 vec4 sampledDiffuseColor=texture2D(map,vMapUv);
 float detail=dot(sampledDiffuseColor.rgb,vec3(.299,.587,.114));
 diffuseColor*=vec4(vec3(clamp(detail*3.0,.35,1.65)),sampledDiffuseColor.a);
#endif`);
        };
        materials.push(material);
      }
      const water=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,
        uniforms:{time:{value:0},sunDirection:{value:new THREE.Vector3()},up:{value:new THREE.Vector3()},
          tint:{value:new THREE.Color('#125d73')},shore:{value:0}}});
      materials.push(water);this.waterMaterial=water;
      this.ground=new THREE.Mesh(geo,materials);this.ground.frustumCulled=false;this.root.add(this.ground);
      if(this.profile.type==='cloud')this.addClouds();
      this.ready=true;this.loadingBody=null;
    }catch(error){this.loadingBody=null;this.error=error.message;console.error('Surface texture error:',error);}
  }
  point(x,z){return new THREE.Vector3(x,this.radiusMeters,z).normalize().applyQuaternion(this.frame);}
  height(x,z){
    if(!this.ready)return 0;
    const d=this.point(x,z),h=this.sample(this.body,d).height;
    return d.multiplyScalar(this.radiusMeters+h).applyQuaternion(this.frame.clone().invert()).y-this.radiusMeters;
  }
  groundHeight(body,direction){
    const fallback=()=>this.sample(body,direction).height;
    if(!this.ready||this.body?.id!==body.id||!this.ground)return fallback();
    const local=direction.clone().applyQuaternion(this.frame.clone().invert());
    if(local.y<=0)return fallback();
    const x=local.x/local.y*this.radiusMeters,z=local.z/local.y*this.radiusMeters;
    if(Math.hypot(x,z)>this.extent*.35)return fallback();
    const segments=128,ix=Math.floor((x/this.extent+.5)*segments),iz=Math.floor((z/this.extent+.5)*segments);
    const positions=this.ground.geometry.attributes.position;
    const ray=new THREE.Ray(new THREE.Vector3(0,-this.radiusMeters,0),local.normalize());
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const col=ix+dx,row=iz+dz;if(col<0||row<0||col>=segments||row>=segments)continue;
      const i=row*(segments+1)+col;
      for(const ids of [[i,i+segments+1,i+1],[i+segments+1,i+segments+2,i+1]]){
        a.fromBufferAttribute(positions,ids[0]);b.fromBufferAttribute(positions,ids[1]);c.fromBufferAttribute(positions,ids[2]);
        if(ray.intersectTriangle(a,b,c,false,hit))return hit.distanceTo(ray.origin)-this.radiusMeters;
      }
    }
    return fallback();
  }
  makeGeometry(segments){
    const geo=new THREE.PlaneGeometry(this.extent,this.extent,segments,segments);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,colors=new Float32Array(pos.count*3),types=[];
    const inverse=this.frame.clone().invert();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),d=this.point(x,z),s=this.sample(this.body,d);
      const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z)/this.extent,.36,.48);
      const p=d.multiplyScalar(this.radiusMeters+s.height*(1-edge)).applyQuaternion(inverse);
      pos.setXYZ(i,p.x,p.y-this.radiusMeters,p.z);uv.setXY(i,x/12,z/12);
      const c=s.color.clone().multiplyScalar(this.body.id==='earth'?1.6:2.2);
      colors.set([c.r,c.g,c.b],i*3);
      types.push(s.profile.type==='water'?4:Math.max(0,['grass','sand','rock','ice'].indexOf(s.profile.type==='volcanic'?'rock':s.profile.type==='cloud'?'ice':s.profile.type)));
    }
    const indices=geo.index.array,groups=[[],[],[],[],[]];
    for(let i=0;i<indices.length;i+=3){
      const ids=[indices[i],indices[i+1],indices[i+2]];
      const x=ids.reduce((sum,j)=>sum+pos.getX(j),0)/3,z=ids.reduce((sum,j)=>sum+pos.getZ(j),0)/3;
      if(Math.hypot(x,z)>this.extent*.48)continue;
      const t=types[ids[0]]===types[ids[1]]?types[ids[0]]:types[ids[2]];
      groups[t].push(...ids);
    }
    geo.clearGroups();const joined=[];
    for(let i=0;i<groups.length;i++){geo.addGroup(joined.length,groups[i].length,i);joined.push(...groups[i]);}
    geo.setIndex(joined);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
  }
  addClouds(){
    const geometry=new THREE.IcosahedronGeometry(1,3),material=new THREE.MeshStandardMaterial({color:new THREE.Color(this.body.color).lerp(new THREE.Color('#fff6e8'),.5),roughness:1});
    const clouds=new THREE.InstancedMesh(geometry,material,110),matrix=new THREE.Matrix4();
    for(let i=0;i<110;i++){
      const a=i*2.399963,r=500+Math.sqrt((i+.5)/110)*7000,x=Math.cos(a)*r,z=Math.sin(a)*r;
      matrix.compose(new THREE.Vector3(x,this.height(x,z)-70,z),new THREE.Quaternion().setFromAxisAngle(upAxis,i),new THREE.Vector3(400+noise2(i,4,this.seed)*500,100+noise2(i,7,this.seed)*120,300+noise2(i,8,this.seed)*400));clouds.setMatrixAt(i,matrix);
    }
    clouds.frustumCulled=false;this.root.add(clouds);
  }
  clearGeometry(){
    this.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
    this.root.clear();this.ground=null;
  }
  leave(){
    this.root.visible=false;this.sky.visible=false;this.ambient.visible=false;this.visible=false;
    this.universe.scene.fog=null;
    for(const n of this.universe.nodes.values())n.uniforms.detailCut.value=-1;
  }
  update(flight,time){
    this.leave();if(!flight)return;
    const near=this.nearest(flight.position);this.near=near;
    if(!near||near.altitude>Math.max(50000,terrainExtent(near.body)*2))return;
    const direction=this.localDirection(near.body.id,flight.position);
    this.prepare(near.body,direction);
    if(!this.ready||this.body?.id!==near.body.id||!surfaceVisible(near.altitude,this.extent,this.ready,!!flight.warp))return;
    const node=this.universe.nodes.get(this.body.id),bodyQ=this.bodyRotation(this.body.id);
    const normal=this.anchor.clone().applyQuaternion(bodyQ),rotation=bodyQ.clone().multiply(this.frame);
    const factor=this.universe.radius(this.body.id)/this.radiusMeters;
    this.root.position.copy(node.group.position).addScaledVector(normal,this.universe.radius(this.body.id));
    this.root.quaternion.copy(rotation);this.root.scale.setScalar(factor);
    this.root.visible=true;this.visible=true;
    // Remove only the globe directly under the detailed disk, retaining the horizon.
    node.uniforms.detailCenter.value.copy(this.anchor);
    node.uniforms.detailCut.value=Math.cos(Math.atan(this.extent*.39/this.radiusMeters));
    if(node.clouds)node.clouds.visible=false;if(node.atmosphere)node.atmosphere.visible=false;
    const sample=this.sample(this.body,direction);this.profile=sample.profile;this.coordinates=sample;
    const sun=node.uniforms.sunDirection.value,air=this.profile.air;
    const daylight=Math.max(.02,direction.clone().applyQuaternion(bodyQ).dot(sun));
    this.ambient.visible=true;this.ambient.color.set(air?'#d0e1f5':'#b0b0b0');this.ambient.groundColor.set(air?'#655447':'#555555');
    this.ambient.intensity=air?.5*daylight:.08+.28*daylight;
    this.sky.visible=air>=.25;this.sky.material.uniforms.up.value.copy(normal);this.sky.material.uniforms.sunDirection.value.copy(sun);
    this.sky.material.uniforms.zenith.value.set(air>1?'#695039':this.body.id==='mars'?'#91694e':'#286ca8').multiplyScalar(daylight);
    this.sky.material.uniforms.horizon.value.set(air>1?'#ba925b':this.body.id==='mars'?'#d4a17b':'#c2d8dd').multiplyScalar(daylight);
    this.sky.material.uniforms.density.value=air;
    this.waterMaterial.uniforms.time.value=time;this.waterMaterial.uniforms.sunDirection.value.copy(sun);this.waterMaterial.uniforms.up.value.copy(normal);
    if(this.sky.visible){this.universe.stars.visible=false;this.universe.scene.backgroundIntensity=.01;
      this.universe.scene.fog=new THREE.Fog((air>1?new THREE.Color('#b39067'):this.body.id==='mars'?new THREE.Color('#c49a79'):new THREE.Color('#bfd6dd')).multiplyScalar(daylight),factor*4000,factor*(air>1?16000:50000));}
  }
  diagnostics(){return {visible:this.visible,ready:this.ready,body:this.body?.id||null,type:this.profile?.type||null,error:this.error,
    color:this.coordinates?.color.toArray(),latitude:this.coordinates?.latitude,longitude:this.coordinates?.longitude,altitude:this.near?.altitude,lazyMaps:!!this.mapPromise};}
}
