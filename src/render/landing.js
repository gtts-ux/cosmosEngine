import * as THREE from 'three';
import { surfaceProfile,seedFor,noise2,terrainHeight,terrainExtent,landingVisible,GROUND_TEXTURES } from '../data/surfaces.js';

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
    this.universe=universe;this.root=new THREE.Group();this.root.visible=false;universe.scene.add(this.root);
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
  async prepare(body,biome='grass'){
    const key=`${body.id}:${biome}`;if(this.key===key&&this.ready)return;
    const serial=++this.serial;this.key=key;this.ready=false;this.error=null;this.root.visible=false;
    try{
      const maps=await this.loadMaps();if(serial!==this.serial)return;
      this.clearGeometry();this.body=body;this.biome=biome;this.profile=surfaceProfile(body,biome);this.seed=seedFor(body.id);
      this.extent=terrainExtent(body);this.radiusMeters=body.radius*1000;
      const profile=this.profile,materialType=profile.type==='cloud'?'ice':['grass','sand','ice'].includes(profile.type)?profile.type:'rock';
      const segments=profile.type==='water'?96:256;
      const geo=this.makeGeometry(profile,segments);
      const tint=new THREE.Color(profile.tint);
      // Photographed, tileable albedo/normal/roughness; ice uses a snow/frost material.
      const ground=new THREE.MeshStandardMaterial({
        color:profile.type==='grass'?0xffffff:tint,map:maps.get(`ground-${materialType}-color.jpg`),
        normalMap:maps.get(`ground-${materialType}-normal.jpg`),normalScale:new THREE.Vector2(.65,.65),
        roughnessMap:maps.get(`ground-${materialType}-rough.jpg`),roughness:profile.type==='ice'?.64:1,
        metalness:0,vertexColors:true,side:THREE.FrontSide,
      });
      if(profile.type==='sand'&&body.id==='earth')ground.color.multiplyScalar(2.4);
      if(profile.type==='cloud'){ground.normalScale.set(.05,.05);ground.color.lerp(new THREE.Color('#fff7e8'),.4);}
      if(profile.type==='volcanic'){
        ground.emissive.set('#da4c0a');ground.emissiveIntensity=.08;
      }
      this.ground=new THREE.Mesh(geo,ground);this.ground.frustumCulled=false;
      if(profile.type!=='water')this.root.add(this.ground);
      else{geo.dispose();ground.dispose();this.ground=null;}
      if(profile.type==='water'||profile.shore||body.id==='titan')this.addWater(profile);
      if(profile.type==='grass')this.addGrass();
      else if(profile.type==='cloud')this.addClouds();
      else if(profile.type!=='water'&&profile.type!=='cloud')this.addRocks(tint);
      this.ready=true;
    }catch(error){this.error=error.message;console.error('Landing texture error:',error);}
  }
  height(x,z){return this.profile?terrainHeight(x,z,this.profile,this.seed)-(x*x+z*z)/(2*this.radiusMeters):0;}
  makeGeometry(profile,segments){
    const geo=new THREE.PlaneGeometry(this.extent,this.extent,segments,segments);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),height=terrainHeight(x,z,profile,this.seed);
      pos.setY(i,height-(x*x+z*z)/(2*this.radiusMeters));uv.setXY(i,x/(profile.type==='cloud'?1200:12),z/(profile.type==='cloud'?1200:12));
      const macro=.82+noise2(x/160,z/160,this.seed+67)*.26;
      let r=macro,g=macro,b=macro;
      if(profile.type==='ice'){
        const cracks=Math.exp(-Math.abs(Math.sin(x/180+Math.sin(z/350)))*28);
        r*=1-cracks*.5;g*=1-cracks*.4;b*=1-cracks*.3;
      }
      if(profile.type==='volcanic'){
        const fissure=Math.abs(Math.sin(x/41+Math.sin(z/83)));
        r*=fissure<.06?.35:1;g*=fissure<.06?.12:1;b*=.7;
      }
      colors.set([r,g,b],i*3);
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
  }
  addWater(profile){
    const waterProfile={...profile,type:'water'},geo=this.makeGeometry(waterProfile,96);
    const mat=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,
      uniforms:{time:{value:0},sunDirection:{value:new THREE.Vector3()},up:{value:new THREE.Vector3()},
        tint:{value:new THREE.Color(this.body.id==='titan'?'#382d1b':'#125d73')},shore:{value:profile.shore?1:0}},
    });
    this.water=new THREE.Mesh(geo,mat);this.water.frustumCulled=false;this.water.position.y=.08;this.root.add(this.water);
  }
  addGrass(){
    const vertices=[];
    for(let blade=0;blade<6;blade++){
      const a=blade*2.4,c=Math.cos(a),s=Math.sin(a),h=.24+blade*.035;
      for(const [x,y,z] of [[-.025,0,0],[.025,0,0],[.015,h*.55,.025],[.025,0,0],[.045,h,.055],[.015,h*.55,.025]])vertices.push(x*c-z*s,y,x*s+z*c);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:0xb0c76f,emissive:0x243b0f,emissiveIntensity:.6,roughness:1,side:THREE.DoubleSide});
    const count=this.universe.settings.quality==='low'?2200:4500;
    const grass=new THREE.InstancedMesh(geometry,material,count),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<count;i++){
      const a=i*2.399963,r=1+Math.sqrt((i+.5)/count)*32,x=Math.cos(a)*r,z=Math.sin(a)*r;
      q.setFromAxisAngle(upAxis,i*1.73);s.setScalar(.5+noise2(i,8,this.seed));
      matrix.compose(new THREE.Vector3(x,this.height(x,z),z),q,s);grass.setMatrixAt(i,matrix);
      grass.setColorAt(i,new THREE.Color().setHSL(.19+noise2(i,1,this.seed)*.08,.38,.38+noise2(i,2,this.seed)*.12));
    }
    grass.frustumCulled=false;this.root.add(grass);
  }
  addRocks(tint){
    const geometry=new THREE.DodecahedronGeometry(1,1),material=new THREE.MeshStandardMaterial({color:tint.clone().multiplyScalar(.7),roughness:.95});
    const count=180,rocks=new THREE.InstancedMesh(geometry,material,count),matrix=new THREE.Matrix4();
    for(let i=0;i<count;i++){
      const a=i*2.399963,r=8+Math.sqrt((i+.5)/count)*240,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.15+noise2(i,14,this.seed)*1.3;
      matrix.compose(new THREE.Vector3(x,this.height(x,z)+size*.25,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i*.4,i*.19)),new THREE.Vector3(size,size*.6,size*.8));rocks.setMatrixAt(i,matrix);
    }
    rocks.frustumCulled=false;this.root.add(rocks);
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
    this.root.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
    this.root.clear();this.water=null;this.ground=null;
  }
  leave(){this.root.visible=false;this.sky.visible=false;this.ambient.visible=false;this.visible=false;this.universe.scene.fog=null;}
  update(flight,time){
    if(!flight||!landingVisible(flight.mode,!!flight.warp,this.ready)||this.body?.id!==flight.target){this.leave();return;}
    const node=this.universe.nodes.get(flight.target),normal=flight.landOffset.clone().normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(upAxis,normal);
    const metersToUnits=node.radius/(this.body.radius*1000);
    this.root.position.copy(node.group.position).addScaledVector(normal,node.radius);
    this.root.quaternion.copy(rotation);this.root.scale.setScalar(metersToUnits);
    this.root.visible=true;this.visible=true;node.mesh.visible=false;
    if(node.clouds)node.clouds.visible=false;if(node.atmosphere)node.atmosphere.visible=false;
    const sun=node.uniforms.sunDirection.value;
    this.ambient.visible=true;this.ambient.position.copy(normal);this.ambient.color.set(this.profile.air?'#d0e1f5':'#8593aa');
    this.ambient.intensity=this.profile.air?.5:.22;
    const air=this.profile.air;
    this.sky.visible=air>0;this.sky.material.uniforms.up.value.copy(normal);this.sky.material.uniforms.sunDirection.value.copy(sun);
    this.sky.material.uniforms.zenith.value.set(air>1?'#695039':this.body.id==='mars'?'#91694e':'#286ca8');
    this.sky.material.uniforms.horizon.value.set(air>1?'#ba925b':this.body.id==='mars'?'#d4a17b':'#c2d8dd');
    this.sky.material.uniforms.density.value=air;
    if(this.water){this.water.material.uniforms.time.value=time;this.water.material.uniforms.sunDirection.value.copy(sun);this.water.material.uniforms.up.value.copy(normal);}
    this.universe.stars.visible=!air;this.universe.scene.backgroundIntensity=air?.01:.18;
    this.universe.scene.fog=air?new THREE.Fog(air>1?0xb39067:this.body.id==='mars'?0xc49a79:0xbfd6dd,metersToUnits*1200,metersToUnits*(air>1?7500:16000)):null;
  }
  diagnostics(){return {visible:this.visible,ready:this.ready,body:this.body?.id||null,type:this.profile?.type||null,error:this.error,lazyMaps:!!this.mapPromise};}
}
