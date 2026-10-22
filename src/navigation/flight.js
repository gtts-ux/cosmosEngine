import * as THREE from 'three';
import {isStar} from '../data/systems.js';
import {canLand,approachScale} from '../data/shapes.js';
import {isGasGiant} from '../data/surfaces.js';
import { telescopeZoom } from '../data/geography.js';
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
    const editing=()=>document.activeElement?.matches('input:not([type=range]):not([type=checkbox]),select,textarea')||document.querySelector('dialog[open]');
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
      dx/=Math.max(1,this.camera.zoom);dy/=Math.max(1,this.camera.zoom);
      if(this.mode==='orbit'){
        this.theta-=dx*.004;this.phi=Math.max(.03,Math.min(Math.PI-.03,this.phi+dy*.004));
      }else if(this.mode==='land'){
        this.landYaw-=dx*.002;this.landPitch=Math.max(-1.35,Math.min(1.35,this.landPitch-dy*.002));
      }else{
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(yAxis,-dx*.002));
        this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis,-dy*.002)).normalize();
      }
    },{signal});
    canvas.addEventListener('pointerup',e=>{
      if(this.mode!=='land'&&this.drag&&!this.drag.moved&&this.drag.button===0){const id=universe.pick(e.clientX,e.clientY);if(id)onPick(id);}
      this.drag=null;if(document.pointerLockElement===canvas)document.exitPointerLock();
    },{signal});
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      if(e.shiftKey||this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')){
        this.camera.zoom=telescopeZoom(this.camera.zoom,e.deltaY||e.deltaX);this.camera.updateProjectionMatrix();return;
      }
      if(this.mode==='orbit')this.distance=Math.max(universe.radius(this.target)*1.000001,Math.min(1e10,this.distance*Math.exp(e.deltaY*.0015)));
      else this.setSpeed(this.speedExponent-e.deltaY*.002);
    },{passive:false,signal});
  }
  get speed(){return 10**this.speedExponent;}
  setSpeed(exponent){this.speedExponent=Math.max(0,Math.min(Math.log10(LIGHT_YEAR_METERS),Number(exponent)));}
  targetPosition(){return new THREE.Vector3(...this.universe.renderPositions[this.target]);}
  lookAt(target,up=yAxis){this.matrix.lookAt(this.position,target,up);this.camera.quaternion.setFromRotationMatrix(this.matrix);}
  offsetFor(id,scale=5.1){
    const point=new THREE.Vector3(...this.universe.renderPositions[id]);
    const towardsSun=this.universe.lightDirection(id);if(isStar(this.universe.nodes.get(id).body))towardsSun.set(0,0,1);
    return towardsSun.applyAxisAngle(yAxis,.62).add(new THREE.Vector3(0,.26,0)).normalize().multiplyScalar(this.universe.radius(id)*scale);
  }
  visit(id,instant=false,kind='orbit'){
    if(kind==='land'&&!canLand(this.universe.nodes.get(id).body))return false;
    this.universe.rebase(this.universe.nodes.get(id).hostId,this);
    const previous=this.target;this.target=id;this.velocity.set(0,0,0);this.keys.clear();this.surfaceFrame=null;
    let offset=this.offsetFor(id,approachScale(this.universe.nodes.get(id).body));
    if(kind==='land'){
      if(previous===id)offset=this.position.clone().sub(this.targetPosition()).normalize();
      this.landLocal=offset.clone().normalize().applyQuaternion(this.universe.landing.bodyRotation(id).invert());
      this.landYaw=0;this.landPitch=-.09;this.landWalk.set(0,0);
      offset.setLength(this.universe.radius(id)+.0005);
      this.universe.landing.prepare(this.universe.nodes.get(id).body,this.landLocal);
    }
    const sphere=new THREE.Spherical().setFromVector3(offset);
    this.theta=sphere.theta;this.phi=sphere.phi;this.distance=sphere.radius;
    this.mode=kind;this.landOffset=offset.clone();const target=this.targetPosition();
    if(instant){this.warp=null;this.position.copy(target).add(offset);this.lookAt(target);}
    else this.warp={start:this.position.clone(),startQuaternion:this.camera.quaternion.clone(),offset,elapsed:0,duration:2.4};
    this.lastTarget.copy(target);this.onModeChange(kind);
  }
  free(){this.mode='free';this.warp=null;this.surfaceFrame=null;this.followSurface();this.keys.clear();this.onModeChange('free');}
  lock(id){
    this.target=id;this.warp=null;this.velocity.set(0,0,0);this.keys.clear();this.surfaceFrame=null;
    const target=this.targetPosition(),spherical=new THREE.Spherical().setFromVector3(this.position.clone().sub(target));
    this.theta=spherical.theta;this.phi=spherical.phi;this.distance=spherical.radius;
    this.mode='orbit';this.lastTarget.copy(target);this.lookAt(target);this.onModeChange('orbit');
  }
  orbit(){this.visit(this.target);}
  overview(hostId='sun'){
    this.universe.rebase(hostId,this);this.camera.zoom=1;this.camera.updateProjectionMatrix();
    this.target=hostId;this.mode='orbit';this.velocity.set(0,0,0);this.keys.clear();this.surfaceFrame=null;
    this.theta=.3;this.phi=.6;const orbits=this.universe.bodies.filter(b=>b.parent===hostId&&b.orbit).map(b=>b.orbit[0]);
    this.distance=Math.max(149597870.7/KM_PER_UNIT*(hostId==='sun'?7:.5),...orbits.map(a=>a/KM_PER_UNIT*2.7));
    this.warp={start:this.position.clone(),startQuaternion:this.camera.quaternion.clone(),offset:new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.distance,this.phi,this.theta)),elapsed:0,duration:2.4};
    this.onModeChange('orbit');
  }
  neighborhood(){
    this.universe.rebase('sun',this);this.camera.zoom=1;this.camera.updateProjectionMatrix();
    this.target='sun';this.mode='orbit';this.velocity.set(0,0,0);this.keys.clear();this.surfaceFrame=null;
    this.theta=.35;this.phi=1.1;const radius=Math.max(...this.universe.bodies.filter(b=>isStar(b)&&!b.blackHole&&!b.fictional).map(b=>Math.hypot(...(b.anchor||[0,0,0]))))/KM_PER_UNIT;
    this.distance=radius/Math.sin(THREE.MathUtils.degToRad(this.camera.fov/2))*1.2;
    this.warp={start:this.position.clone(),startQuaternion:this.camera.quaternion.clone(),offset:new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.distance,this.phi,this.theta)),elapsed:0,duration:2.4};
    this.onModeChange('orbit');
  }
  landPose(){
    const landing=this.universe.landing,body=this.universe.nodes.get(this.target).body;
    const bodyQ=landing.bodyRotation(this.target),sample=landing.sample(body,this.landLocal);
    const normal=this.landLocal.clone().applyQuaternion(bodyQ),factor=this.universe.radius(this.target)/(body.radius*1000);
    const offset=normal.multiplyScalar(this.universe.radius(this.target)+(landing.groundHeight(body,this.landLocal)+(sample.profile.type==='cloud'?500:5))*factor);
    const q=bodyQ.multiply(new THREE.Quaternion().setFromUnitVectors(yAxis,this.landLocal)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.landPitch,this.landYaw,0,'YXZ')));
    return {offset,q};
  }
  update(dt){
    const target=this.targetPosition();
    if(this.warp){
      const w=this.warp;w.elapsed+=dt;const t=Math.min(1,w.elapsed/w.duration),smooth=t*t*(3-2*t);
      const pose=this.mode==='land'?this.landPose():null;
      if(pose)w.offset.copy(pose.offset);
      this.position.lerpVectors(w.start,target.clone().add(w.offset),smooth);
      this.matrix.lookAt(this.position,target,yAxis);
      const q=pose?.q||new THREE.Quaternion().setFromRotationMatrix(this.matrix);
      this.camera.quaternion.slerpQuaternions(w.startQuaternion,q,Math.min(1,t*3));if(t===1){this.position.copy(target).add(w.offset);this.warp=null;}
    }else if(this.mode==='orbit'){
      const offset=new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.distance,this.phi,this.theta));
      const body=this.universe.nodes.get(this.target).body,base=this.universe.radius(this.target),factor=base/(body.radius*1000);
      if(canLand(body)&&this.distance<base+50000*factor){
        const local=offset.clone().normalize().applyQuaternion(this.universe.landing.bodyRotation(this.target).invert());
        const floor=base+(this.universe.landing.groundHeight(body,local)+5)*factor;
        if(offset.length()<floor)offset.setLength(floor);
      }
      this.position.copy(target).add(offset);this.lookAt(target);
    }else if(this.mode==='land'){
      const input=new THREE.Vector3(Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),0,Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW')));
      if(input.lengthSq()){
        input.normalize().applyAxisAngle(yAxis,this.landYaw).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(yAxis,this.landLocal));
        this.landLocal.addScaledVector(input,dt*(this.boost?20:5)/(this.universe.nodes.get(this.target).body.radius*1000)).normalize();
      }
      const pose=this.landPose();this.position.copy(target).add(pose.offset);this.camera.quaternion.copy(pose.q);
    }else{
      this.followSurface();
      const input=new THREE.Vector3(Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),Number(this.keys.has('ArrowUp'))-Number(this.keys.has('ArrowDown')),Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW')));
      if(input.lengthSq())input.normalize().applyQuaternion(this.camera.quaternion).multiplyScalar(this.speed/(KM_PER_UNIT*1000)*(this.boost?8:1));
      this.velocity.lerp(input,1-Math.exp(-dt*4.5));if(this.velocity.length()<1e-12)this.velocity.set(0,0,0);
      const previous=this.position.clone();this.position.addScaledVector(this.velocity,dt);
      this.camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis,(Number(this.keys.has('KeyQ'))-Number(this.keys.has('KeyE')))*dt*.9)).normalize();
      this.collide(previous);
    }
    this.lastTarget.copy(target);
  }
  get boost(){return this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');}
  collide(previous){
    const movement=this.position.clone().sub(previous),length2=movement.lengthSq();
    for(const b of this.universe.localBodies||this.universe.bodies){
      if(isGasGiant(b))continue;
      const center=new THREE.Vector3(...this.universe.renderPositions[b.id]),base=this.universe.radius(b.id),factor=base/(b.radius*1000);
      let radius=base+5*factor;
      if(canLand(b)&&this.position.distanceTo(center)<base+50000*factor){
        radius=base+(this.universe.landing.groundHeight(b,this.universe.landing.localDirection(b.id,this.position))+5)*factor;
      }
      const relative=previous.clone().sub(center);let t=length2?Math.max(0,Math.min(1,-relative.dot(movement)/length2)):0;
      if(relative.clone().addScaledVector(movement,t).lengthSq()<radius*radius){
        const B=relative.dot(movement),C=relative.lengthSq()-radius*radius,disc=B*B-length2*C;
        t=length2&&disc>=0?Math.max(0,(-B-Math.sqrt(disc))/length2):0;
        const outward=previous.clone().addScaledVector(movement,t).sub(center).normalize();
        this.position.copy(center).addScaledVector(outward,radius);this.velocity.set(0,0,0);break;
      }
    }
  }
  followSurface(){
    const old=this.surfaceFrame;
    if(old){
      const body=this.universe.nodes.get(old.id).body,radius=this.universe.radius(old.id),factor=radius/(body.radius*1000);
      const altitude=(this.position.distanceTo(old.center)-radius)/factor;
      if(altitude<200000){
        const center=new THREE.Vector3(...this.universe.renderPositions[old.id]),q=this.universe.landing.bodyRotation(old.id);
        const delta=q.clone().multiply(old.q.clone().invert());this.position.sub(old.center).applyQuaternion(delta).add(center);
        this.velocity.applyQuaternion(delta);this.camera.quaternion.premultiply(delta);
      }
    }
    const near=this.universe.landing.nearest(this.position);
    if(!near||near.altitude>200000){this.surfaceFrame=null;return;}
    const id=near.body.id;this.surfaceFrame={id,center:new THREE.Vector3(...this.universe.renderPositions[id]),q:this.universe.landing.bodyRotation(id)};
  }
  rescale(oldRadius){
    const target=this.targetPosition(),ratio=this.universe.radius(this.target)/oldRadius;this.velocity.set(0,0,0);this.warp=null;this.surfaceFrame=null;
    if(this.mode==='orbit')this.distance*=ratio;else if(this.mode==='land')this.landOffset.multiplyScalar(ratio);else this.position.sub(this.lastTarget).multiplyScalar(ratio).add(target);
    this.lastTarget.copy(target);
  }
}
