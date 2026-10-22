import * as THREE from 'three';
import { terrainExtent,GROUND_TEXTURES } from '../data/surfaces.js';

import { SurfaceAtlas } from './geography.js';
import {isStar} from '../data/systems.js';
import { shapeFactor,canLand } from '../data/shapes.js';
import {terrainVertex,terrainFragment} from './terrain-shaders.js';
import { surfaceVisible } from '../data/geography.js';

const upAxis=new THREE.Vector3(0,1,0);
const waterVertex=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec2 globeUv;attribute vec3 basePosition;uniform float terrainBlend;varying vec2 atlasUV;
  varying vec3 p,n,worldPoint;
  void main(){atlasUV=globeUv;p=mix(basePosition,position,terrainBlend);n=normalize(mat3(modelMatrix)*normal);worldPoint=(modelMatrix*vec4(p,1)).xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1);
    #include <logdepthbuf_vertex>
  }`;
const waterFragment=`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D dayMap;uniform float time,terrainBlend,metersToUnits;varying vec2 atlasUV;uniform vec3 sunDirection,tint,up;
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
    vec3 orbital=texture2D(dayMap,atlasUV).rgb*(.012+max(dot(base,L),0.0)*1.65);
    float level=(1.0-smoothstep(30.0,4000.0,length(worldPoint-cameraPosition)/metersToUnits))*terrainBlend;
    color=mix(orbital,color,level);
    gl_FragColor=vec4(color,1);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
export class LandingTerrain {
  constructor(universe){
    this.universe=universe;this.atlas=new SurfaceAtlas(universe);this.root=new THREE.Group();this.root.visible=false;universe.scene.add(this.root);
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
      if(isStar(body))continue;
      const radius=this.universe.radius(body.id),factor=radius/(body.radius*1000);
      const local=this.localDirection(body.id,position);
      const altitude=(position.distanceTo(new THREE.Vector3(...this.universe.renderPositions[body.id]))-radius*shapeFactor(body,local.toArray()))/factor;
      const ground=canLand(body)&&altitude<50000?this.sample(body,local).mountain:0;
      if(!best||altitude-ground<best.altitude)best={body,altitude:altitude-ground};
    }
    return best;
  }
  async prepare(body,direction){
    if(!canLand(body))return;
    if(this.loadingBody===body.id)return;
    if(this.ready&&this.body?.id===body.id&&this.anchor.angleTo(direction)*body.radius*1000<this.extent*.18)return;
    const serial=++this.serial;this.loadingBody=body.id;this.error=null;
    try{
      const maps=await this.loadMaps();if(serial!==this.serial)return;
      this.clearGeometry();this.body=body;this.anchor=direction.clone().normalize();
      this.frame=new THREE.Quaternion().setFromUnitVectors(upAxis,this.anchor);
      this.profile=this.sample(body,this.anchor).profile;
      this.extent=terrainExtent(body);this.radiusMeters=body.radius*1000;
      const geo=this.makeGeometry(256),materials=[];
      this.detailUniforms={terrainBlend:{value:0},metersToUnits:{value:1},
        dayMap:this.universe.nodes.get(body.id).uniforms.dayMap,sunDirection:this.universe.nodes.get(body.id).uniforms.sunDirection};
      for(const type of ['grass','sand','rock','ice']){
        materials.push(new THREE.ShaderMaterial({vertexShader:terrainVertex,fragmentShader:terrainFragment,
          uniforms:{...this.detailUniforms,detailMap:{value:maps.get(`ground-${type}-color.jpg`)},
            normalMap:{value:maps.get(`ground-${type}-normal.jpg`)},roughMap:{value:maps.get(`ground-${type}-rough.jpg`)}}}));
      }
      const water=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment,
        uniforms:{time:{value:0},sunDirection:{value:new THREE.Vector3()},up:{value:new THREE.Vector3()},
          tint:{value:new THREE.Color('#125d73')},...this.detailUniforms}});
      materials.push(water);this.waterMaterial=water;
      this.ground=new THREE.Mesh(geo,materials);this.ground.frustumCulled=false;this.root.add(this.ground);
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
    const segments=256,ix=Math.floor((x/this.extent+.5)*segments),iz=Math.floor((z/this.extent+.5)*segments);
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
    const pos=geo.attributes.position,uv=geo.attributes.uv,basePositions=new Float32Array(pos.count*3),globeUVs=new Float32Array(pos.count*2),types=[];
    const anchorU=this.sample(this.body,this.anchor).u;
    const inverse=this.frame.clone().invert();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),d=this.point(x,z),s=this.sample(this.body,d);
      const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z)/this.extent,.36,.48);
      const shapeHeight=(shapeFactor(this.body,d.toArray())-1)*this.radiusMeters;
      const macro=shapeHeight+s.mountain;
      const baseline=d.clone().multiplyScalar(this.radiusMeters+macro).applyQuaternion(inverse);
      basePositions.set([baseline.x,baseline.y-this.radiusMeters,baseline.z],i*3);
      let u=s.u;if(u-anchorU>.5)u-=1;if(u-anchorU<-.5)u+=1;
      globeUVs.set([u,1-s.v],i*2);
      const p=d.multiplyScalar(this.radiusMeters+macro+(s.height-macro)*(1-edge)).applyQuaternion(inverse);
      pos.setXYZ(i,p.x,p.y-this.radiusMeters,p.z);uv.setXY(i,x/12,z/12);
      types.push(s.profile.type==='water'?4:Math.max(0,['grass','sand','rock','ice'].indexOf(s.profile.type==='volcanic'?'rock':s.profile.type==='cloud'?'ice':s.profile.type)));
    }
    const indices=geo.index.array,groups=[[],[],[],[],[]];
    for(let i=0;i<indices.length;i+=3){
      const ids=[indices[i],indices[i+1],indices[i+2]];
      const x=ids.reduce((sum,j)=>sum+uv.getX(j)*12,0)/3,z=ids.reduce((sum,j)=>sum+uv.getY(j)*12,0)/3;
      if(Math.hypot(x,z)>this.extent*.48)continue;
      const t=types[ids[0]]===types[ids[1]]?types[ids[0]]:types[ids[2]];
      groups[t].push(...ids);
    }
    geo.clearGroups();const joined=[];
    for(let i=0;i<groups.length;i++){geo.addGroup(joined.length,groups[i].length,i);for(const index of groups[i])joined.push(index);}
    geo.setIndex(joined);geo.setAttribute('basePosition',new THREE.BufferAttribute(basePositions,3));geo.setAttribute('globeUv',new THREE.BufferAttribute(globeUVs,2));geo.computeVertexNormals();return geo;
  }
  clearGeometry(){
    this.root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
    this.root.clear();this.ground=null;
  }
  leave(){
    this.root.visible=false;this.visible=false;this.detailBlend=0;
    this.universe.scene.fog=null;
    for(const n of this.universe.nodes.values())n.uniforms.detailCut.value=-1;
  }
  update(flight,time){
    this.leave();if(!flight)return;
    const near=this.nearest(flight.position);this.near=near;
    if(!near||!canLand(near.body)||near.altitude>Math.max(50000,terrainExtent(near.body)*2))return;
    const direction=this.localDirection(near.body.id,flight.position);
    this.prepare(near.body,direction);
    if(!this.ready||this.body?.id!==near.body.id||!surfaceVisible(near.altitude,this.extent,this.ready,!!flight.warp))return;
    const node=this.universe.nodes.get(this.body.id),bodyQ=this.bodyRotation(this.body.id);
    const normal=this.anchor.clone().applyQuaternion(bodyQ),rotation=bodyQ.clone().multiply(this.frame);
    const factor=this.universe.radius(this.body.id)/this.radiusMeters;
    this.root.position.copy(node.group.position).addScaledVector(normal,this.universe.radius(this.body.id));
    this.root.quaternion.copy(rotation);this.root.scale.setScalar(factor);
    this.root.visible=true;this.visible=true;
    this.detailBlend=1-THREE.MathUtils.smoothstep(near.altitude,this.extent*.055,this.extent*.3);
    this.detailUniforms.terrainBlend.value=this.detailBlend;this.detailUniforms.metersToUnits.value=factor;
    // Remove only the globe directly under the detailed disk, retaining the horizon.
    node.uniforms.detailCenter.value.copy(this.anchor);
    node.uniforms.detailCut.value=Math.cos(Math.atan(this.extent*.39/this.radiusMeters));
    if(node.clouds)node.clouds.visible=false;if(node.atmosphere)node.atmosphere.visible=false;
    const sample=this.sample(this.body,direction);this.profile=sample.profile;this.coordinates=sample;
    const sun=node.uniforms.sunDirection.value;
    this.waterMaterial.uniforms.time.value=time;this.waterMaterial.uniforms.sunDirection.value.copy(sun);this.waterMaterial.uniforms.up.value.copy(normal);
    // Atmospheric extinction is handled once, after scene rendering, including other planets.

  }
  diagnostics(){return {visible:this.visible,detailBlend:this.detailBlend||0,detailLevel:this.detailBlend>.95?'local':this.detailBlend>0?'regional':'orbital',ready:this.ready,body:this.body?.id||null,type:this.profile?.type||null,error:this.error,
    color:this.coordinates?.color.toArray(),latitude:this.coordinates?.latitude,longitude:this.coordinates?.longitude,altitude:this.near?.altitude,lazyMaps:!!this.mapPromise};}
}
