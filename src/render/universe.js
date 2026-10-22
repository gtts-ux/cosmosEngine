import {GalaxyField} from './galaxy-field.js';
import {addBlackHole} from './black-hole.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AU, J2000, positionsAt, sampleOrbit } from '../physics/orbits.js';
import { sphereVertex, surfaceFragment, atmosphereFragment, cloudFragment, sunFragment, ringFragment, gasFragment } from './shaders.js';
import {isStar,hostStarId} from '../data/systems.js';
import {atmosphereFor} from '../data/atmospheres.js';
import { solidTexture,proceduralTexture,textureFromPixels } from './textures.js';
import { AtmosphericPass } from './atmosphere.js';
import { shapeFactor,canLand } from '../data/shapes.js';
import {isGasGiant} from '../data/surfaces.js';
import {SurfaceJobs} from './surface-jobs.js';
import {seedFor} from '../data/surfaces.js';
import { LandingTerrain } from './landing.js';

export const KM_PER_UNIT=1000;
const temp=new THREE.Vector3();
function material(fragment,uniforms,extra={}) {
  return new THREE.ShaderMaterial({vertexShader:sphereVertex,fragmentShader:fragment,uniforms,...extra});
}
function shapeGeometry(body,segments){
  const geo=new THREE.SphereGeometry(1,segments,Math.floor(segments/2)),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const d=[pos.getX(i),pos.getY(i),pos.getZ(i)],f=shapeFactor(body,d);pos.setXYZ(i,d[0]*f,d[1]*f,d[2]*f);}
  geo.computeVertexNormals();return geo;
}
function seeded(seed) { return ()=>{ seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296; }; }
export class Universe {
  constructor(canvas,bodies,textures,settings) {
    this.bodies=[];this.settings=settings;this.textures=textures;this.nodes=new Map();
    this.jobs=new SurfaceJobs();this.textureWork=new Map();this.textureLevels=new Map();this.textureUsed=new Map();this.highMaps=new Map();this.streamError=null;this.frameEMA=16.7;this.renderScale=.85;this.nextAdapt=0;
    this.referenceSystem='sun';this.referenceAnchor=[0,0,0];this.positions={};this.renderPositions={};this.origin=new THREE.Vector3();this.drawCount=0;
    this.scene=new THREE.Scene();this.scene.matrixWorldAutoUpdate=false;
    this.camera=new THREE.PerspectiveCamera(48,1,1e-9,1e20);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x03060c,1);
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=settings.exposure;
    this.renderer.debug.onShaderError=(gl,program,vs,fs)=>{
      const message=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].join('\n');
      this.shaderError=message;console.error('Shader compilation failed:',message);
    };
    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),settings.bloom,.6,1);
    this.composer.addPass(this.bloom);
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2]){
      target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);target.depthTexture.minFilter=target.depthTexture.magFilter=THREE.NearestFilter;
    }
    this.airPass=new AtmosphericPass(this);this.composer.addPass(this.airPass);this.composer.addPass(new OutputPass());
    const sky=textures.get('2k_stars_milky_way.jpg');
    sky.mapping=THREE.EquirectangularReflectionMapping;
    // Three.js converts the equirectangular panorama to a cubemap for the sky.
    this.scene.background=sky;this.scene.backgroundIntensity=.18;
    this.scene.backgroundRotation.set(.8,.3,.4);
    this.sunLight=new THREE.PointLight(0xfff4e6,2,0,0);
    this.sunLight.castShadow=true;this.sunLight.shadow.mapSize.set(512,512);
    this.scene.add(this.sunLight);
    const geo=new THREE.SphereGeometry(1,96,64);
    this.gasSphere=new THREE.SphereGeometry(1,160,96);this.lowSphere=geo;this.surfaceSphere=geo;
    this.black=solidTexture(0,0,0);this.normal=solidTexture(128,128,255);
    this.addBodies(bodies);
    this.createStars();this.createNearbyStars();
    this.landing=new LandingTerrain(this);this.galaxyField=new GalaxyField(this);
    this.setSettings(settings);
  }
  addBodies(bodies){
    const geo=this.lowSphere,black=this.black,normal=this.normal;
    for(const b of bodies) {
      if(this.nodes.has(b.id))continue;
      this.bodies.push(b);
      if(!this.textures.has(b.texture||b.id)){const c=new THREE.Color(b.color).getRGB({},THREE.SRGBColorSpace);this.textures.set(b.id,solidTexture(c.r*255,c.g*255,c.b*255));}
      const group=new THREE.Group();this.scene.add(group);
      const spin=new THREE.Group();group.add(spin);
      // Axial tilts are visual orientations, not full IAU rotational elements.
      spin.rotation.z=THREE.MathUtils.degToRad(b.tilt||0);
      const airColor=new THREE.Color(b.id==='mars'?'#d78858':b.id==='venus'||b.id==='titan'?'#eeb972':b.id==='saturn'?'#d4bd8d':b.id==='jupiter'?'#ccb596':b.id==='uranus'?'#8ccad2':'#429bff');
      const hasAir=!!atmosphereFor(b);
      const uniforms={
        gasVariant:{value:b.generated?1:0},gasSeed:{value:seedFor(b.id)%1000},gasTint:{value:new THREE.Color(b.color)},cloudBoundary:{value:1},oceanWorld:{value:b.id==='earth'||b.surfaceType==='ocean'?1:0},
        stellarTint:{value:new THREE.Color(b.id==='sun'?'#ffffff':isStar(b)?b.color:'#ffffff')},stellarBlend:{value:isStar(b)&&b.id!=='sun'?1:0},
        detailCenter:{value:new THREE.Vector3(0,1,0)},detailCut:{value:-1},detailBlend:{value:0},
        dayMap:{value:this.textures.get(b.texture||b.id)},nightMap:{value:b.id==='earth'?this.textures.get('2k_earth_nightmap.jpg'):black},
        normalMap:{value:b.id==='earth'?this.textures.get('earth-normal.png'):normal},specMap:{value:b.id==='earth'?this.textures.get('earth-specular.png'):black},
        sunDirection:{value:new THREE.Vector3(1,0,0)},atmosphereColor:{value:airColor},
        hasNight:{value:b.id==='earth'?1:0},hasNormal:{value:b.id==='earth'?1:0},
        hasSpecular:{value:b.id==='earth'||b.surfaceType==='ocean'?1:0},hasAtmosphere:{value:hasAir?1:0},
        time:{value:0},radius:{value:1},ringOuter:{value:b.id==='saturn'?2.35:b.id==='uranus'?2:0},
        ringNormal:{value:new THREE.Vector3(0,1,0)},center:{value:new THREE.Vector3()},
        shadowEnabled:{value:this.settings.shadows?1:0},occluder:{value:new THREE.Vector3()},occluderRadius:{value:0},
      };
      const shapeLow=b.axes?shapeGeometry(b,32):isGasGiant(b)?this.gasSphere:geo,shapeHigh=shapeLow;
      const mesh=new THREE.Mesh(shapeLow,material(isStar(b)?sunFragment:isGasGiant(b)?gasFragment:surfaceFragment,uniforms));
      mesh.userData.body=b;spin.add(mesh);
      const node={body:b,hostId:isStar(b)?b.id:this.nodes.get(b.parent)?.hostId||'sun',group,spin,mesh,uniforms,shapeLow,shapeHigh,radius:b.radius/KM_PER_UNIT};
      if(!b.blackHole&&(hasAir||isStar(b))) {
        const atmosphere=new THREE.Mesh(isGasGiant(b)?this.gasSphere:geo,material(atmosphereFragment,{
          sunDirection:uniforms.sunDirection,atmosphereColor:{value:isStar(b)?new THREE.Color(b.color):airColor},
          strength:{value:isStar(b)?1.2:b.id==='mars'?.45:1.15},
        },{transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));
        atmosphere.scale.setScalar(isStar(b)?1.16:b.id==='venus'||b.id==='titan'?1.055:1.025);
        spin.add(atmosphere);node.atmosphere=atmosphere;
      }
      if(b.id==='earth'||b.surfaceType==='ocean'){
        node.clouds=new THREE.Mesh(geo,material(cloudFragment,{
          cloudMap:{value:this.textures.get('2k_earth_clouds.jpg')},sunDirection:uniforms.sunDirection,
        },{transparent:true,depthWrite:false}));
        node.clouds.scale.setScalar(1.0018);spin.add(node.clouds);
      }
      if(b.id==='saturn'||b.id==='uranus'){
        const outer=b.id==='saturn'?2.35:2;
        const ringGeo=new THREE.RingGeometry(b.id==='saturn'?1.24:1.8,outer,256,6);
        const ringMat=material(ringFragment,{
          sunLocal:{value:new THREE.Vector3()},tint:{value:new THREE.Color(b.id==='saturn'?'#cabc9b':'#a0b1b4')},
          outer:{value:outer},shadowEnabled:uniforms.shadowEnabled,
        },{transparent:true,side:THREE.DoubleSide,depthWrite:false});
        node.ring=new THREE.Mesh(ringGeo,ringMat);node.ring.rotation.x=-Math.PI/2;spin.add(node.ring);
      }
      if(b.parent){
        const orbitGeo=new THREE.BufferGeometry();
        const line=new THREE.Line(orbitGeo,new THREE.LineBasicMaterial({color:b.color,transparent:true,opacity:b.kind==='Planet'?.18:.1,depthWrite:false}));
        line.frustumCulled=false;this.scene.add(line);node.orbit=line;
      }
      if(b.blackHole)addBlackHole(node);
      this.nodes.set(b.id,node);
    }
    this.reindex();
  }
  reindex(){
    this.starBodies=this.bodies.filter(isStar);this.systemBodies=new Map(this.starBodies.map(s=>[s.id,[]]));this.satellites=new Map(this.bodies.map(b=>[b.id,[]]));
    for(const b of this.bodies){if(!isStar(b))this.systemBodies.get(this.nodes.get(b.id).hostId)?.push(b);if(b.kind==='Natural satellite'){this.satellites.get(b.parent)?.push(b);const parent=this.nodes.get(b.parent)?.body;if(parent)this.satellites.get(b.id).push(parent);}}
    this.localBodies=this.systemBodies.get(this.activeSystem||this.referenceSystem)||[];this.initialPositions=false;this.positionsInitialized=false;this.lastOrbitJD=undefined;
  }
  removeBodies(ids){
    const removed=new Set(ids);
    for(const id of ids){const n=this.nodes.get(id);if(!n)continue;
      if(this.landing.body?.id===id){this.landing.serial++;this.landing.leave();this.landing.clearGeometry();this.landing.ready=false;this.landing.loadingBody=null;}
      n.group.removeFromParent();n.orbit?.removeFromParent();n.group.traverse(o=>{if(o.material)o.material.dispose();});
      for(const g of new Set([n.shapeLow,n.terrainGeometry,n.disk?.geometry,n.orbit?.geometry]))if(g&&g!==this.lowSphere&&g!==this.gasSphere)g.dispose();n.orbit?.material.dispose();
      if(!n.body.texture){this.textures.get(id)?.dispose();this.textures.delete(id);}this.textureLevels.delete(id);this.textureUsed.delete(id);this.nodes.delete(id);delete this.positions[id];delete this.renderPositions[id];this.landing.atlas.cache.delete(id);
    }
    this.bodies=this.bodies.filter(b=>!removed.has(b.id));this.reindex();this.rebuildStarPoints();
  }
  rebuildStarPoints(){if(this.nearbyStars){this.nearbyStars.removeFromParent();this.nearbyStars.geometry.dispose();this.nearbyStars.material.dispose();}this.createNearbyStars();}
  ensureTexture(body,width=2048){
    const node=this.nodes.get(body.id);if(!node)return Promise.resolve();
    if(isGasGiant(body)){
      const base=body.texture||'2k_jupiter.jpg',high=base.replace('2k_','8k_');
      if(!['8k_jupiter.jpg','8k_saturn.jpg'].includes(high)||this.settings.quality==='low'||width<2048)return Promise.resolve();
      this.textureUsed.set(high,performance.now());
      if(this.highMaps.has(high)){node.uniforms.dayMap.value=this.highMaps.get(high);return Promise.resolve();}
      if(this.textureWork.has(high))return this.textureWork.get(high).then(()=>{node.uniforms.dayMap.value=this.highMaps.get(high)||this.textures.get(base);});
      const task=window.cosmos.texture(high).then(url=>new THREE.TextureLoader().loadAsync(url)).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;this.highMaps.set(high,t);node.uniforms.dayMap.value=t;}).catch(e=>{this.streamError=e.message;}).finally(()=>this.textureWork.delete(high));this.textureWork.set(high,task);return task;
    }
    if(body.texture)return Promise.resolve();
    this.textureUsed.set(body.id,performance.now());
    if((this.textureLevels.get(body.id)||0)>=width)return Promise.resolve();
    if(this.textureWork.has(body.id))return this.textureWork.get(body.id).then(()=>this.ensureTexture(body,width));
    const task=this.jobs.run('texture',{body,width}).then(pixels=>{
      if(!this.nodes.has(body.id)||(node.hostId!==this.activeSystem&&node.hostId!==this.referenceSystem))return;
      const texture=textureFromPixels(pixels),previous=this.textures.get(body.id);this.textures.set(body.id,texture);node.uniforms.dayMap.value=texture;
      previous?.dispose();this.textureLevels.set(body.id,width);this.onTextureReady?.(body);this.landing?.atlas.cache.delete(body.id);
    }).catch(e=>{this.streamError=e.message;}).finally(()=>this.textureWork.delete(body.id));this.textureWork.set(body.id,task);return task;
  }
  pruneTextures(time){
    if(time<(this.nextPrune||0))return;this.nextPrune=time+2;
    for(const n of this.nodes.values())if(n.hostId!==this.activeSystem){if(n.terrainGeometry){n.mesh.geometry=n.shapeLow;n.terrainGeometry.dispose();n.terrainGeometry=null;n.terrainResolution=0;}if(n.orbit?.geometry.attributes.position){n.orbit.geometry.dispose();n.orbit.geometry=new THREE.BufferGeometry();}}
    let memory=[...this.textureLevels.values()].reduce((n,w)=>n+w*w/2*4*1.34,0);
    for(const [id,width] of [...this.textureLevels].sort((a,b)=>(this.textureUsed.get(a[0])||0)-(this.textureUsed.get(b[0])||0))){
      const node=this.nodes.get(id),age=performance.now()-(this.textureUsed.get(id)||0);
      if(node.hostId===this.activeSystem&&(memory<64*1024*1024||age<2000))continue;
      this.textures.get(id)?.dispose();const c=new THREE.Color(node.body.color).getRGB({},THREE.SRGBColorSpace),placeholder=solidTexture(c.r*255,c.g*255,c.b*255);
      this.textures.set(id,placeholder);node.uniforms.dayMap.value=placeholder;this.textureLevels.delete(id);this.landing.atlas.cache.delete(id);memory-=width*width/2*4*1.34;
    }
    for(const [name,t] of this.highMaps)if(performance.now()-(this.textureUsed.get(name)||0)>20000){for(const n of this.nodes.values())if(n.uniforms.dayMap.value===t)n.uniforms.dayMap.value=this.textures.get(n.body.texture);t.dispose();this.highMaps.delete(name);}
  }
  adaptResolution(dt,now){
    if(dt<=0||dt>.25)return;
    this.frameEMA=this.frameEMA*.95+dt*1000*.05;
    if(now<this.nextAdapt||this.drawCount<90||this.settings.adaptive===false)return;
    let next=this.renderScale;
    if(this.frameEMA>25)next=Math.max(.5,next-(this.frameEMA>50?.2:.1));
    else if(this.frameEMA<18&&now>(this.lastScaleDrop||0)+8000)next=Math.min(this.maxScale,next+.05);
    this.nextAdapt=now+(this.frameEMA>35?650:1200);
    if(Math.abs(next-this.renderScale)>.01){if(next<this.renderScale)this.lastScaleDrop=now;this.renderScale=next;this.renderer.setPixelRatio(Math.min(devicePixelRatio,next));this.resize();}
  }
  rebase(hostId,flight){
    if(hostId===this.referenceSystem)return;
    const anchor=this.nodes.get(hostId)?.body.anchor||[0,0,0];
    const delta=new THREE.Vector3(...anchor.map((v,i)=>(v-this.referenceAnchor[i])/KM_PER_UNIT));
    if(flight){flight.position.sub(delta);flight.lastTarget.sub(delta);if(flight.warp)flight.warp.start.sub(delta);if(flight.surfaceFrame)flight.surfaceFrame.center.sub(delta);}
    for(const p of Object.values(this.renderPositions)){p[0]-=delta.x;p[1]-=delta.y;p[2]-=delta.z;}
    this.origin.sub(delta);this.referenceAnchor=[...anchor];this.referenceSystem=hostId;
    this.updatePositions(this.lastJD||J2000);
  }
  closestStar(position){
    let best=null,distance=Infinity;
    for(const body of this.starBodies){const node=this.nodes.get(body.id);
      const d=position.distanceTo(new THREE.Vector3(...(this.renderPositions[node.body.id]||node.body.anchor?.map(v=>v/KM_PER_UNIT)||[0,0,0])));
      if(d<distance){distance=d;best=node;}
    }
    return best;
  }
  lightDirection(id){
    const n=this.nodes.get(id),p=this.renderPositions[id],star=this.renderPositions[n.hostId]||[0,0,0];
    return new THREE.Vector3(...star).sub(new THREE.Vector3(...p)).normalize();
  }
  createNearbyStars(){
    this.starIds=this.bodies.filter(b=>isStar(b)&&!b.blackHole).map(b=>b.id);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(this.starIds.length*3),3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(this.starIds.flatMap(id=>new THREE.Color(this.nodes.get(id).body.color).toArray()),3));
    geo.setAttribute('size',new THREE.Float32BufferAttribute(new Float32Array(this.starIds.length),1));
    const mat=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;varying vec3 c;void main(){c=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);gl_PointSize=size;
#include <logdepthbuf_vertex>
}`,
      fragmentShader:`#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 c;void main(){
#include <logdepthbuf_fragment>
float d=length(gl_PointCoord-.5);if(d>.5)discard;
float core=exp(-d*d*180.0),halo=exp(-d*d*22.0)*.25;
gl_FragColor=vec4(mix(c,vec3(1.0),.45)*5.0,core+halo);}`});
    this.nearbyStars=new THREE.Points(geo,mat);this.nearbyStars.frustumCulled=false;this.scene.add(this.nearbyStars);
  }
  radius(id) {
    const b=this.nodes.get(id).body;
    // Balanced mode enlarges bodies but leaves heliocentric distances unchanged.
    return b.radius/KM_PER_UNIT*(this.settings.balanced?(isStar(b)?3:b.kind==='Planet'?Math.max(8,80/Math.sqrt(b.radius/6371)):b.radius<150?4:60):1);
  }
  createStars(){
    const rand=seeded(72583),count=16000,pos=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count);
    for(let i=0;i<count;i++){
      const z=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-z*z);
      pos.set([r*Math.cos(a)*1e7,z*1e7,r*Math.sin(a)*1e7],i*3);
      const c=new THREE.Color().setHSL(.55+rand()*.13,.05+rand()*.25,.6+rand()*.35);
      colors.set([c.r,c.g,c.b],i*3);sizes[i]=rand()>.996?3:rand()>.95?1.8:1;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setAttribute('size',new THREE.BufferAttribute(sizes,1));
    const mat=new THREE.ShaderMaterial({
      vertexColors:true,depthWrite:false,depthTest:false,transparent:false,
      uniforms:{pixelRatio:{value:1}},
      vertexShader:`attribute float size;uniform float pixelRatio;varying vec3 c;void main(){c=color;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1);gl_Position=p;gl_Position.z=p.w*.99999;gl_PointSize=size*pixelRatio;}`,
      fragmentShader:`varying vec3 c;void main(){float d=length(gl_PointCoord-.5);if(d>.48)discard;gl_FragColor=vec4(c*1.6*smoothstep(.5,.05,d),1.0);}`,
    });
    this.stars=new THREE.Points(geo,mat);this.stars.frustumCulled=false;this.stars.renderOrder=-100;this.scene.add(this.stars);
  }
  setSettings(settings){
    this.settings={...settings};
    this.maxScale=settings.quality==='high'?1.35:settings.quality==='medium'?.85:.65;this.renderScale=this.maxScale;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.renderScale));
    this.renderer.toneMappingExposure=settings.exposure;
    this.bloom.strength=settings.bloom;this.bloom.enabled=settings.bloom>0;
    this.stars.geometry.setDrawRange(0,settings.stars);
    this.stars.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio();
    for(const node of this.nodes.values())node.uniforms.shadowEnabled.value=settings.shadows?1:0;
    this.resize();
    this.lastOrbitJD=undefined;
  }
  resize(){
    const w=window.innerWidth,h=window.innerHeight;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);
    this.bloom.setSize(w*this.renderer.getPixelRatio()*.65,h*this.renderer.getPixelRatio()*.65);
  }
  updatePositions(jd) {
    this.lastJD=jd;
    const focus=new Set([this.referenceSystem,this.activeSystem||this.referenceSystem]);
    const tracked=[...this.starBodies,...this.bodies.filter(b=>!isStar(b)&&focus.has(this.nodes.get(b.id).hostId))];
    const computed=positionsAt(this.initialPositions?tracked:this.bodies,jd,this.referenceAnchor);this.initialPositions=true;this.positions={...this.positions,...computed};
    for(const b of (this.positionsInitialized?tracked:this.bodies)){
      let p=this.positions[b.id].map(v=>v/KM_PER_UNIT);
      if(this.settings.balanced && b.parent && b.parent!=='sun'){
        const parentTrue=this.positions[b.parent],parentRender=this.renderPositions[b.parent];
        const scale=this.radius(b.parent)/(this.nodes.get(b.parent).body.radius/KM_PER_UNIT);
        p=p.map((v,i)=>parentRender[i]+(v-parentTrue[i]/KM_PER_UNIT)*scale);
      }
      this.renderPositions[b.id]=p;
      this.nodes.get(b.id).mesh.rotation.y=((jd-J2000)/(Math.abs(b.rotation)||1)*Math.PI*2)%(Math.PI*2);
    }
    this.positionsInitialized=true;
    if(this.settings.orbitLines&&(this.lastOrbitJD===undefined||Math.abs(jd-this.lastOrbitJD)>30||this.lastOrbitSystem!==this.referenceSystem)){
      for(const node of this.nodes.values())if(node.orbit&&focus.has(node.hostId)){
        const points=sampleOrbit(node.body,jd);
        let factor=1/KM_PER_UNIT;
        if(this.settings.balanced&&node.body.parent!=='sun')factor*=this.radius(node.body.parent)/(this.nodes.get(node.body.parent).body.radius/KM_PER_UNIT);
        node.orbit.geometry.dispose();
        node.orbit.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p).multiplyScalar(factor)));
      }
      this.lastOrbitJD=jd;this.lastOrbitSystem=this.referenceSystem;
    }
  }
  updateScene(jd,time,origin,flight) {
    if(flight)this.galaxyField.update(flight,time);
    this.origin.copy(origin);this.camera.position.set(0,0,0);this.camera.updateMatrixWorld();
    const primary=this.closestStar(origin),nextSystem=primary?.body.id||'sun';
    if(nextSystem!==this.activeSystem){for(const n of this.nodes.values()){n.group.visible=isStar(n.body)||n.hostId===nextSystem;if(n.orbit)n.orbit.visible=false;}this.activeSystem=nextSystem;this.localBodies=this.systemBodies.get(nextSystem)||[];}
    const activeBodies=[...this.starBodies,...this.localBodies];
    let insideDayAtmosphere=false;
    for(const b of activeBodies){
      const node=this.nodes.get(b.id);
      node.group.visible=isStar(b)||node.hostId===this.activeSystem;
      node.mesh.visible=this.radius(b.id)/Math.max(this.radius(b.id),new THREE.Vector3(...this.renderPositions[b.id]).distanceTo(origin))>(isStar(b)?.00015:.00008);
      if(node.disk)node.disk.visible=node.mesh.visible;
      if(node.clouds)node.clouds.visible=true;
      if(node.atmosphere)node.atmosphere.visible=node.mesh.visible;
      node.group.position.fromArray(this.renderPositions[b.id]).sub(origin);
      const radius=this.radius(b.id);node.group.scale.setScalar(radius);node.radius=radius;
      const distance=node.group.position.length();
      if(!isStar(b)&&radius/Math.max(radius,distance)>.001)this.ensureTexture(b,distance<radius*12?2048:512);
      if(canLand(b)&&radius/Math.max(radius,distance)>.015){
        const resolution=distance<radius*(node.terrainResolution===256?2.1:1.6)?256:96;
        if(node.terrainResolution!==resolution&&!node.terrainPending){
          node.terrainPending=true;
          this.ensureTexture(b,distance<radius*12?2048:512).then(()=>this.jobs.run('globe',{body:b,segments:resolution,atlas:this.landing.atlas.pixels(b)})).then(data=>{
            if(!this.nodes.has(b.id)||node.hostId!==this.activeSystem)return;
            const geometry=this.jobs.geometry(data);node.terrainGeometry?.dispose();node.terrainGeometry=geometry;node.terrainResolution=resolution;
          }).catch(e=>{this.streamError=e.message;}).finally(()=>node.terrainPending=false);
        }
        node.mesh.geometry=node.terrainGeometry||node.shapeLow;
      }else{
        node.mesh.geometry=node.shapeLow;
        if(node.terrainGeometry){node.terrainGeometry.dispose();node.terrainGeometry=null;node.terrainResolution=0;}
      }
      // Cloud tops are a volume boundary, never a solid floor. Fade them before
      // entry; the atmospheric integration supplies the opaque interior instead.
      node.uniforms.cloudBoundary.value=isGasGiant(b)?THREE.MathUtils.smoothstep((distance-radius)/(radius/(b.radius*1000)),0,100000):1;
      if(isGasGiant(b)&&distance<radius)node.mesh.visible=false;
      node.mesh.rotation.y=((jd-J2000)/(Math.abs(b.rotation)||1)*Math.PI*2)%(Math.PI*2);
      if(node.clouds)node.clouds.rotation.y=node.mesh.rotation.y+((jd-J2000)/7.5*Math.PI*2)%(Math.PI*2);
      node.uniforms.radius.value=radius;node.uniforms.center.value.copy(node.group.position);
      node.uniforms.time.value=time;
      node.uniforms.sunDirection.value.copy(this.lightDirection(b.id));
      if(isStar(b))node.uniforms.sunDirection.value.copy(node.group.position).negate().normalize();
      if(node.atmosphere && !isStar(b) && node.group.position.length()<radius*1.025 &&
        node.group.position.clone().negate().normalize().dot(node.uniforms.sunDirection.value)>0)insideDayAtmosphere=true;
      node.uniforms.ringNormal.value.set(0,1,0).applyQuaternion(node.spin.quaternion);
      if(node.ring)node.ring.material.uniforms.sunLocal.value.copy(node.uniforms.sunDirection.value).applyQuaternion(node.spin.quaternion.clone().invert());
      const satellites=this.satellites.get(b.id)||[];
      let candidate=null,best=Infinity;
      for(const sat of satellites){
        temp.fromArray(this.renderPositions[sat.id]).sub(new THREE.Vector3(...this.renderPositions[b.id]));
        const along=temp.dot(node.uniforms.sunDirection.value);
        if(along>0){
          const miss=temp.clone().addScaledVector(node.uniforms.sunDirection.value,-along).length();
          if(miss<best){best=miss;candidate=sat;}
        }
      }
      node.uniforms.occluderRadius.value=candidate?this.radius(candidate.id):0;
      if(candidate)node.uniforms.occluder.value.fromArray(this.renderPositions[candidate.id]).sub(origin);
      if(node.orbit){
        node.orbit.visible=this.settings.orbitLines&&node.hostId===this.activeSystem;
        node.orbit.position.fromArray(this.renderPositions[b.parent]||[0,0,0]).sub(origin);
      }
    }
    this.stars.visible=!insideDayAtmosphere&&this.galaxyField.currentGalaxy==='milky-way';
    this.scene.backgroundIntensity=insideDayAtmosphere?.012:this.galaxyField.currentGalaxy==='milky-way'?.12:0;
    if(primary){this.sunLight.position.copy(primary.group.position);this.sunLight.color.set(primary.body.color);}
    const angular=primary?primary.radius/Math.max(primary.radius,primary.group.position.length()):0;
    this.bloom.strength=this.settings.bloom*(angular>.025?.32:1);
    const starPositions=this.nearbyStars.geometry.attributes.position,starSizes=this.nearbyStars.geometry.attributes.size;
    for(let i=0;i<this.starIds.length;i++){
      const n=this.nodes.get(this.starIds[i]),p=n.group.position,d=p.length(),ly=d*KM_PER_UNIT/9.4607304725808e12;
      starPositions.setXYZ(i,p.x,p.y,p.z);
      const luminosity=n.body.id==='sun'?1:n.body.catalogLuminosity||.00001;
      starSizes.setX(i,n.radius/Math.max(d,n.radius)>.002?0:THREE.MathUtils.clamp(12-Math.log10(Math.max(.001,ly))*1.2+Math.log10(luminosity)*.65,8,20)*this.renderer.getPixelRatio());
    }
    starPositions.needsUpdate=true;starSizes.needsUpdate=true;
    this.landing.update(flight,time);
    this.airPass.update(origin,time);
    for(const b of activeBodies){const n=this.nodes.get(b.id);n.group.updateMatrixWorld(true);if(n.orbit?.visible)n.orbit.updateMatrixWorld();}
    this.landing.root.updateMatrixWorld(true);
    this.pruneTextures(time);
  }
  render(){
    this.composer.render();
    this.drawCount++;
  }
  pick(clientX,clientY){
    const point=new THREE.Vector2(clientX/window.innerWidth*2-1,-clientY/window.innerHeight*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(point,this.camera);
    const hits=ray.intersectObjects([...this.nodes.values()].filter(n=>n.group.visible&&n.mesh.visible).map(n=>n.mesh),false);
    let star=null,miss=12;
    for(const id of this.starIds){const p=this.project(id);if(!p)continue;const d=Math.hypot(p.x-clientX,p.y-clientY);
      if(d<miss&&(!hits[0]||this.nodes.get(id).group.position.length()<hits[0].distance)){miss=d;star=id;}}
    const sector=!hits.length&&!star?this.galaxyField.pick(clientX,clientY):null;if(sector){this.onApproachStar?.(sector);return sector.id;}
    return star||hits[0]?.object.userData.body.id;
  }
  project(id){
    if(this.airPass.state.transmission<.02&&id!==this.airPass.state.body)return null;
    const n=this.nodes.get(id);if(!n.group.visible)return null;const v=n.group.position.clone(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    if(v.dot(forward)<=0)return null;
    v.project(this.camera);
    if(Math.abs(v.x)>1||Math.abs(v.y)>1)return null;
    return {x:(v.x*.5+.5)*window.innerWidth,y:(-.5*v.y+.5)*window.innerHeight};
  }
  getDiagnostics(){
    return {galaxy:this.galaxyField.diagnostics(),webgl:this.renderer.getContext().getParameter(this.renderer.getContext().VERSION),frames:this.drawCount,
      shaderError:this.shaderError||null,streamError:this.streamError,streamingJobs:this.jobs.pending.size,renderScale:this.renderScale,residentGeneratedTextures:this.textureLevels.size,residentHighMaps:this.highMaps.size,activeBodies:this.localBodies.length,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,
      logarithmicDepthBuffer:this.renderer.capabilities.logarithmicDepthBuffer,referenceSystem:this.referenceSystem,referenceAnchorKM:[...this.referenceAnchor],bodies:this.nodes.size,nearbyStars:this.starIds.length,activeSystem:this.activeSystem,atmosphere:{...this.airPass.state},texturesRepaired:[...this.textures.entries()].filter(([,t])=>t.userData.repairedPixels).map(([name,t])=>({name,pixels:t.userData.repairedPixels})),irregularBodies:this.bodies.filter(b=>b.axes).map(b=>b.id),landing:this.landing.diagnostics()};
  }
}
