import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AU, J2000, positionsAt, sampleOrbit } from '../physics/orbits.js';
import { sphereVertex, surfaceFragment, atmosphereFragment, cloudFragment, sunFragment, ringFragment } from './shaders.js';
import { solidTexture } from './textures.js';
import { AtmosphericPass } from './atmosphere.js';
import { shapeFactor } from '../data/shapes.js';
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
    this.bodies=bodies;this.settings=settings;this.textures=textures;this.nodes=new Map();
    this.positions={};this.renderPositions={};this.origin=new THREE.Vector3();this.drawCount=0;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(48,1,1e-9,1e14);
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
    this.lowSphere=geo;this.surfaceSphere=new THREE.SphereGeometry(1,1024,512);
    const black=solidTexture(0,0,0),normal=solidTexture(128,128,255);
    for(const b of bodies) {
      const group=new THREE.Group();this.scene.add(group);
      const spin=new THREE.Group();group.add(spin);
      // Axial tilts are visual orientations, not full IAU rotational elements.
      spin.rotation.z=THREE.MathUtils.degToRad(b.tilt||0);
      const airColor=new THREE.Color(b.id==='mars'?'#d78858':b.id==='venus'||b.id==='titan'?'#eeb972':b.id==='saturn'?'#d4bd8d':b.id==='jupiter'?'#ccb596':b.id==='uranus'?'#8ccad2':'#429bff');
      const hasAir=['earth','mars','venus','jupiter','saturn','uranus','neptune','titan'].includes(b.id);
      const uniforms={
        detailCenter:{value:new THREE.Vector3(0,1,0)},detailCut:{value:-1},
        dayMap:{value:textures.get(b.texture||b.id)},nightMap:{value:b.id==='earth'?textures.get('2k_earth_nightmap.jpg'):black},
        normalMap:{value:b.id==='earth'?textures.get('earth-normal.png'):normal},specMap:{value:b.id==='earth'?textures.get('earth-specular.png'):black},
        sunDirection:{value:new THREE.Vector3(1,0,0)},atmosphereColor:{value:airColor},
        hasNight:{value:b.id==='earth'?1:0},hasNormal:{value:b.id==='earth'?1:0},
        hasSpecular:{value:b.id==='earth'?1:0},hasAtmosphere:{value:hasAir?1:0},
        time:{value:0},radius:{value:1},ringOuter:{value:b.id==='saturn'?2.35:b.id==='uranus'?2:0},
        ringNormal:{value:new THREE.Vector3(0,1,0)},center:{value:new THREE.Vector3()},
        shadowEnabled:{value:settings.shadows?1:0},occluder:{value:new THREE.Vector3()},occluderRadius:{value:0},
      };
      const shapeLow=b.axes?shapeGeometry(b,96):geo,shapeHigh=b.axes?shapeGeometry(b,256):this.surfaceSphere;
      const mesh=new THREE.Mesh(shapeLow,material(b.id==='sun'?sunFragment:surfaceFragment,uniforms));
      mesh.userData.body=b;spin.add(mesh);
      const node={body:b,group,spin,mesh,uniforms,shapeLow,shapeHigh,radius:b.radius/KM_PER_UNIT};
      if(hasAir||b.id==='sun') {
        const atmosphere=new THREE.Mesh(geo,material(atmosphereFragment,{
          sunDirection:uniforms.sunDirection,atmosphereColor:{value:b.id==='sun'?new THREE.Color('#ff8b32'):airColor},
          strength:{value:b.id==='sun'?1.2:b.id==='mars'?.45:1.15},
        },{transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));
        atmosphere.scale.setScalar(b.id==='sun'?1.16:b.id==='venus'||b.id==='titan'?1.055:1.025);
        spin.add(atmosphere);node.atmosphere=atmosphere;
      }
      if(b.id==='earth'){
        node.clouds=new THREE.Mesh(geo,material(cloudFragment,{
          cloudMap:{value:textures.get('2k_earth_clouds.jpg')},sunDirection:uniforms.sunDirection,
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
      this.nodes.set(b.id,node);
    }
    this.createStars();
    this.landing=new LandingTerrain(this);
    this.setSettings(settings);
  }
  radius(id) {
    const b=this.nodes.get(id).body;
    // Balanced mode enlarges bodies but leaves heliocentric distances unchanged.
    return b.radius/KM_PER_UNIT*(this.settings.balanced?(b.id==='sun'?3:b.kind==='Planet'?Math.max(8,80/Math.sqrt(b.radius/6371)):b.radius<150?4:60):1);
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.5:settings.quality==='medium'?1:.75));
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
    this.positions=positionsAt(this.bodies,jd);
    for(const b of this.bodies){
      let p=this.positions[b.id].map(v=>v/KM_PER_UNIT);
      if(this.settings.balanced && b.parent && b.parent!=='sun'){
        const parentTrue=this.positions[b.parent],parentRender=this.renderPositions[b.parent];
        const scale=this.radius(b.parent)/(this.nodes.get(b.parent).body.radius/KM_PER_UNIT);
        p=p.map((v,i)=>parentRender[i]+(v-parentTrue[i]/KM_PER_UNIT)*scale);
      }
      this.renderPositions[b.id]=p;
      this.nodes.get(b.id).mesh.rotation.y=((jd-J2000)/(Math.abs(b.rotation)||1)*Math.PI*2)%(Math.PI*2);
    }
    if(this.lastOrbitJD===undefined||Math.abs(jd-this.lastOrbitJD)>30){
      for(const node of this.nodes.values())if(node.orbit){
        const points=sampleOrbit(node.body,jd);
        let factor=1/KM_PER_UNIT;
        if(this.settings.balanced&&node.body.parent!=='sun')factor*=this.radius(node.body.parent)/(this.nodes.get(node.body.parent).body.radius/KM_PER_UNIT);
        node.orbit.geometry.dispose();
        node.orbit.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p).multiplyScalar(factor)));
      }
      this.lastOrbitJD=jd;
    }
  }
  updateScene(jd,time,origin,flight) {
    this.origin.copy(origin);this.camera.position.set(0,0,0);this.camera.updateMatrixWorld();
    let insideDayAtmosphere=false;
    for(const node of this.nodes.values()){
      const b=node.body;
      node.mesh.visible=true;
      if(node.clouds)node.clouds.visible=true;
      if(node.atmosphere)node.atmosphere.visible=true;
      node.group.position.fromArray(this.renderPositions[b.id]).sub(origin);
      const radius=this.radius(b.id);node.group.scale.setScalar(radius);node.radius=radius;
      node.mesh.geometry=node.group.position.length()<radius*1.15?node.shapeHigh:node.shapeLow;
      node.mesh.rotation.y=((jd-J2000)/(Math.abs(b.rotation)||1)*Math.PI*2)%(Math.PI*2);
      if(node.clouds)node.clouds.rotation.y=node.mesh.rotation.y+((jd-J2000)/7.5*Math.PI*2)%(Math.PI*2);
      node.uniforms.radius.value=radius;node.uniforms.center.value.copy(node.group.position);
      node.uniforms.time.value=time;
      node.uniforms.sunDirection.value.fromArray(this.renderPositions[b.id]).negate().normalize();
      if(b.id==='sun')node.uniforms.sunDirection.value.copy(node.group.position).negate().normalize();
      if(node.atmosphere && b.id!=='sun' && node.group.position.length()<radius*1.025 &&
        node.group.position.clone().negate().normalize().dot(node.uniforms.sunDirection.value)>0)insideDayAtmosphere=true;
      node.uniforms.ringNormal.value.set(0,1,0).applyQuaternion(node.spin.quaternion);
      if(node.ring)node.ring.material.uniforms.sunLocal.value.copy(node.uniforms.sunDirection.value).applyQuaternion(node.spin.quaternion.clone().invert());
      const satellites=this.bodies.filter(s=>(s.parent===b.id && s.kind==='Natural satellite') || (b.kind==='Natural satellite' && s.id===b.parent));
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
        node.orbit.visible=this.settings.orbitLines;
        node.orbit.position.fromArray(this.renderPositions[b.parent]||[0,0,0]).sub(origin);
      }
    }
    this.stars.visible=!insideDayAtmosphere;
    this.scene.backgroundIntensity=insideDayAtmosphere?.012:.18;
    this.sunLight.position.copy(this.nodes.get('sun').group.position);
    const sunNode=this.nodes.get('sun');
    this.bloom.strength=this.settings.bloom*(sunNode.radius/Math.max(sunNode.radius,sunNode.group.position.length())>.025?.32:1);
    this.landing.update(flight,time);
    this.airPass.update(origin,time);
    this.scene.updateMatrixWorld();
  }
  render(){
    this.composer.render();
    this.drawCount++;
  }
  pick(clientX,clientY){
    const point=new THREE.Vector2(clientX/window.innerWidth*2-1,-clientY/window.innerHeight*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(point,this.camera);
    const hits=ray.intersectObjects([...this.nodes.values()].map(n=>n.mesh),false);
    return hits[0]?.object.userData.body.id;
  }
  project(id){
    if(this.airPass.state.transmission<.02&&id!==this.airPass.state.body)return null;
    const n=this.nodes.get(id),v=n.group.position.clone(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    if(v.dot(forward)<=0)return null;
    v.project(this.camera);
    if(Math.abs(v.x)>1||Math.abs(v.y)>1)return null;
    return {x:(v.x*.5+.5)*window.innerWidth,y:(-.5*v.y+.5)*window.innerHeight};
  }
  getDiagnostics(){
    return {webgl:this.renderer.getContext().getParameter(this.renderer.getContext().VERSION),frames:this.drawCount,
      shaderError:this.shaderError||null,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,
      logarithmicDepthBuffer:this.renderer.capabilities.logarithmicDepthBuffer,bodies:this.nodes.size,atmosphere:{...this.airPass.state},texturesRepaired:[...this.textures.entries()].filter(([,t])=>t.userData.repairedPixels).map(([name,t])=>({name,pixels:t.userData.repairedPixels})),irregularBodies:this.bodies.filter(b=>b.axes).map(b=>b.id),landing:this.landing.diagnostics()};
  }
}
