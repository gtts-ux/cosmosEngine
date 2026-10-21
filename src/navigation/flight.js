import * as THREE from 'three';
import { KM_PER_UNIT } from '../render/universe.js';
const yAxis=new THREE.Vector3(0,1,0),xAxis=new THREE.Vector3(1,0,0),zAxis=new THREE.Vector3(0,0,1);
export const LIGHT_YEAR_METERS=9.4607304725808e15;
export function speedLabel(mps) {
  if(mps>=LIGHT_YEAR_METERS*.01)return `${(mps/LIGHT_YEAR_METERS).toFixed(2)} ly/s`;
  if(mps>=149597870700*.01)return `${(mps/149597870700).toFixed(2)} AU/s`;
  if(mps>=1000)return `${(mps/1000).toLocaleString('en-US',{maximumFractionDigits:1})} km/s`;
  return `${mps.toFixed(mps<10?1:0)} m/s`;
}
export class Flight {
  constructor(universe,canvas,onModeChange,onPick) {
    this.universe=universe;this.canvas=canvas;this.camera=universe.camera;
    this.position=new THREE.Vector3();this.velocity=new THREE.Vector3();this.keys=new Set();
    this.mode='orbit';this.target='earth';this.distance=universe.radius('earth')*5.1;
    this.theta=0;this.phi=1.32;this.speedExponent=6;this.warp=null;this.drag=null;this.onModeChange=onModeChange;
    this.matrix=new THREE.Matrix4();this.lastTarget=new THREE.Vector3();
    this.landWalk=new THREE.Vector2();this.landYaw=0;this.landPitch=-.07;
    this.abort=new AbortController();const signal=this.abort.signal;
    const editing=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]');
    window.addEventListener('keydown',e=>{
      if(editing())return;
      if(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'].includes(e.code)){
        e.preventDefault();
        if(this.mode==='orbit' && ['KeyW','KeyS','KeyA','KeyD'].includes(e.code))this.free();
        this.keys.add(e.code);
      }
    },{signal});
    window.addEventListener('keyup',e=>this.keys.delete(e.code),{signal});
    window.addEventListener('blur',()=>{this.keys.clear();this.drag=null;this.velocity.set(0,0,0);},{signal});
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),{signal});
    canvas.addEventListener('pointerdown',e=>{
      this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,moved:false};
      canvas.setPointerCapture(e.pointerId);
      if(this.mode==='free'&&e.button===2)canvas.requestPointerLock()?.catch(()=>{});
    },{signal});
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag && document.pointerLockElement!==canvas)return;
      let dx=e.movementX,dy=e.movementY;
      if(this.drag){
        if(document.pointerLockElement!==canvas){dx=e.clientX-this.drag.x;dy=e.clientY-this.drag.y;}
        this.drag.x=e.clientX;this.drag.y=e.clientY;
        if(Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>4)this.drag.moved=true;
      }
      if(this.mode==='orbit'){
        this.theta-=dx*.004;this.phi=Math.max(.03,Math.min(Math.PI-.03,this.phi+dy*.004));
      }else if(this.mode==='land'){
        this.landYaw-=dx*.002;this.landPitch=Math.max(-1.35,Math.min(1.35,this.landPitch-dy*.002));
      }else{
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis,-dx*.002));
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis,-dy*.002));
        this.camera.quaternion.normalize();
      }
    },{signal});
    canvas.addEventListener('pointerup',e=>{
      if(this.mode!=='land'&&this.drag&&!this.drag.moved&&this.drag.button===0){
        const id=universe.pick(e.clientX,e.clientY);if(id)onPick(id);
      }
      this.drag=null;if(document.pointerLockElement===canvas)document.exitPointerLock();
    },{signal});
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      if(this.mode==='orbit'){
        this.distance=Math.max(universe.radius(this.target)*1.015,Math.min(1e10,this.distance*Math.exp(e.deltaY*.0015)));
      }else this.speedExponent=Math.max(0,Math.min(Math.log10(LIGHT_YEAR_METERS),this.speedExponent-e.deltaY*.002));
    },{passive:false,signal});
  }
  get speed(){return 10**this.speedExponent;}
  setSpeed(exponent){this.speedExponent=Math.max(0,Math.min(Math.log10(LIGHT_YEAR_METERS),Number(exponent)));}
  targetPosition(){return new THREE.Vector3(...this.universe.renderPositions[this.target]);}
  lookAt(target,up=yAxis){
    this.matrix.lookAt(this.position,target,up);this.camera.quaternion.setFromRotationMatrix(this.matrix);
  }
  offsetFor(id,scale=5.1) {
    const point=new THREE.Vector3(...this.universe.renderPositions[id]);
    const towardsSun=point.clone().negate().normalize();
    if(id==='sun')towardsSun.set(0,0,1);
    const offset=towardsSun.applyAxisAngle(yAxis,.62).add(new THREE.Vector3(0,.26,0)).normalize();
    return offset.multiplyScalar(this.universe.radius(id)*scale);
  }
  visit(id,instant=false,kind='orbit'){
    this.target=id;this.velocity.set(0,0,0);this.keys.clear();
    const offset=this.offsetFor(id,kind==='land'?1.0001:id==='saturn'||id==='uranus'?8.2:5.1);
    if(kind==='land')offset.setLength(this.universe.radius(id)+Math.max(.0005,this.universe.radius(id)*.00003));
    const target=this.targetPosition();
    const sphere=new THREE.Spherical().setFromVector3(offset);
    this.theta=sphere.theta;this.phi=sphere.phi;this.distance=sphere.radius;
    this.mode=kind;this.landOffset=offset.clone();
    if(kind==='land'){this.landWalk.set(0,0);this.landYaw=0;this.landPitch=-.09;}
    if(instant){this.warp=null;this.position.copy(target).add(offset);this.lookAt(target);}
    else this.warp={start:this.position.clone(),startQuaternion:this.camera.quaternion.clone(),offset,elapsed:0,duration:2.4};
    this.lastTarget.copy(target);this.onModeChange(kind);
  }
  free(){
    this.mode='free';this.warp=null;this.keys.clear();this.onModeChange('free');
  }
  orbit(){this.visit(this.target);}
  overview(){
    this.target='sun';this.mode='orbit';this.velocity.set(0,0,0);this.keys.clear();
    this.theta=.3;this.phi=.6;this.distance=149597870.7/KM_PER_UNIT*7;
    this.warp={start:this.position.clone(),startQuaternion:this.camera.quaternion.clone(),
      offset:new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.distance,this.phi,this.theta)),elapsed:0,duration:2.4};
    this.onModeChange('orbit');
  }
  update(dt){
    const target=this.targetPosition();
    if(this.warp){
      const w=this.warp;w.elapsed+=dt;
      const t=Math.min(1,w.elapsed/w.duration),smooth=t*t*(3-2*t);
      if(this.mode==='land'&&this.universe.landing.body?.id===this.target&&this.universe.landing.ready){
        const height=this.universe.landing.height(0,0),factor=this.universe.radius(this.target)/(this.universe.nodes.get(this.target).body.radius*1000);
        const clearance=this.universe.landing.profile.type==='cloud'?500:1.8;
        w.offset.copy(this.landOffset).normalize().multiplyScalar(this.universe.radius(this.target)+(height+clearance)*factor);
      }
      const end=target.clone().add(w.offset);
      this.position.lerpVectors(w.start,end,smooth);
      this.matrix.lookAt(this.position,target,yAxis);
      const q=new THREE.Quaternion().setFromRotationMatrix(this.matrix);
      if(this.mode==='land')q.setFromUnitVectors(yAxis,this.landOffset.clone().normalize()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.landPitch,this.landYaw,0,'YXZ')));
      this.camera.quaternion.slerpQuaternions(w.startQuaternion,q,Math.min(1,t*3));
      if(t===1)this.warp=null;
    }else if(this.mode==='orbit'){
      this.position.copy(target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.distance,this.phi,this.theta)));
      this.lookAt(target);
    }else if(this.mode==='land'){
      const up=this.landOffset.clone().normalize();
      const frame=new THREE.Quaternion().setFromUnitVectors(yAxis,up);
      const input=new THREE.Vector3(Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),0,Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW')));
      if(input.lengthSq())input.normalize().applyAxisAngle(yAxis,this.landYaw).multiplyScalar(dt*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?20:5));
      this.landWalk.x+=input.x;this.landWalk.y+=input.z;
      const landing=this.universe.landing,extent=(landing.extent||1000)*.38;
      this.landWalk.clampLength(0,extent);
      const height=landing.body?.id===this.target?landing.height(this.landWalk.x,this.landWalk.y):0;
      const factor=this.universe.radius(this.target)/(this.universe.nodes.get(this.target).body.radius*1000);
      this.position.copy(target).addScaledVector(up,this.universe.radius(this.target));
      const clearance=landing.profile?.type==='cloud'?500:1.8;
      this.position.add(new THREE.Vector3(this.landWalk.x,height+clearance,this.landWalk.y).applyQuaternion(frame).multiplyScalar(factor));
      const look=new THREE.Quaternion().setFromEuler(new THREE.Euler(this.landPitch,this.landYaw,0,'YXZ'));
      this.camera.quaternion.copy(frame).multiply(look);
    }else {
      const input=new THREE.Vector3(
        Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),
        Number(this.keys.has('ArrowUp'))-Number(this.keys.has('ArrowDown')),
        Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW')),
      );
      const boost=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?8:1;
      if(input.lengthSq()>0)input.normalize().applyQuaternion(this.camera.quaternion).multiplyScalar(this.speed/(KM_PER_UNIT*1000)*boost);
      this.velocity.lerp(input,1-Math.exp(-dt*4.5));
      if(this.velocity.length()<1e-12)this.velocity.set(0,0,0);
      const previous=this.position.clone();
      this.position.addScaledVector(this.velocity,dt);
      const roll=Number(this.keys.has('KeyQ'))-Number(this.keys.has('KeyE'));
      this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis,roll*dt*.9)).normalize();
      // Swept-segment collision, including high-speed flight across a small planet.
      const movement=this.position.clone().sub(previous),length2=movement.lengthSq();
      for(const b of this.universe.bodies){
        const center=new THREE.Vector3(...this.universe.renderPositions[b.id]),radius=this.universe.radius(b.id)*1.00001;
        const relative=previous.clone().sub(center);
        let t=length2?Math.max(0,Math.min(1,-relative.dot(movement)/length2)):0;
        const closest=relative.clone().addScaledVector(movement,t);
        if(closest.lengthSq()<radius*radius){
          const B=relative.dot(movement),C=relative.lengthSq()-radius*radius,disc=B*B-length2*C;
          t=length2&&disc>=0?Math.max(0,(-B-Math.sqrt(disc))/length2):0;
          this.position.copy(previous).addScaledVector(movement,t);
          const outward=this.position.clone().sub(center).normalize();
          this.position.copy(center).addScaledVector(outward,radius*1.000001);
          this.velocity.set(0,0,0);break;
        }
      }
    }
    this.lastTarget.copy(target);
  }
  rescale(oldRadius){
    const target=this.targetPosition(),ratio=this.universe.radius(this.target)/oldRadius;
    this.velocity.set(0,0,0);this.warp=null;
    if(this.mode==='orbit')this.distance*=ratio;
    else if(this.mode==='land')this.landOffset.multiplyScalar(ratio);
    else this.position.sub(this.lastTarget).multiplyScalar(ratio).add(target);
    this.lastTarget.copy(target);
  }
}
