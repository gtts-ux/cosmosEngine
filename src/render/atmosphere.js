import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {atmosphereFor,verticalTransmission} from '../data/atmospheres.js';
import {isGasGiant} from '../data/surfaces.js';

// Integrates extinction along a view ray, clipped by the logarithmic scene depth.
// A dense atmosphere therefore attenuates planets, rings, stars and bloom alike.
export class AtmosphericPass extends ShaderPass {
  constructor(universe){
    super({uniforms:{tDiffuse:{value:null},tDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},
      center:{value:new THREE.Vector3()},sun:{value:new THREE.Vector3()},tint:{value:new THREE.Color()},
      radius:{value:1},top:{value:1},scaleHeight:{value:1},optical:{value:0},gas:{value:0},logFar:{value:1},time:{value:0},distortion:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`
      precision highp float;
      uniform sampler2D tDiffuse,tDepth;uniform mat4 inverseProjection,cameraWorld;
      uniform vec3 center,sun,tint;uniform float radius,top,scaleHeight,optical,gas,logFar,time,distortion;
      varying vec2 vUv;
      float cloud(vec3 p){return (sin(p.x+sin(p.z*1.3))+sin(p.y*1.7+cos(p.x*.8))+sin(p.z*2.3+sin(p.y)))/6.0+.5;}
      void main(){
        if(optical<=0.0){gl_FragColor=texture2D(tDiffuse,vUv);return;}
        vec4 view=inverseProjection*vec4(vUv*2.0-1.0,1.0,1.0);vec3 local=normalize(view.xyz);
        vec3 ray=normalize((cameraWorld*vec4(local,0.0)).xyz);
        float along=dot(center,ray),disc=along*along-dot(center,center)+top*top;
        if(disc<=0.0){gl_FragColor=texture2D(tDiffuse,vUv);return;}
        float start=max(0.0,along-sqrt(disc)),finish=along+sqrt(disc);
        float depth=texture2D(tDepth,vUv).x;
        float sceneDistance=(exp2(depth*logFar)-1.0)/max(.00001,-local.z);
        finish=min(finish,sceneDistance);
        bool inside=gas>.5&&length(center)<radius+scaleHeight*.1;
        if(inside)finish=min(finish,start+scaleHeight*8.0/max(optical,1.0));
        float stepLength=max(0.0,finish-start)/12.0,tau=0.0,cloudLight=0.0;
        for(int i=0;i<12;i++){
          vec3 p=ray*(start+(float(i)+.5)*stepLength)-center;
          float altitude=max(0.0,length(p)-radius);
          float turbulence=inside?cloud(p/(scaleHeight*.035)+vec3(time*.015,0.0,time*.008)):1.0;
          tau+=exp(-altitude/scaleHeight)*stepLength/scaleHeight*(inside?.4+turbulence*1.4:1.0);
          cloudLight+=turbulence/12.0;
        }
        tau=min(80.0,tau*optical);float transmission=exp(-tau);
        vec3 up=-center/max(length(center),.000001);float day=smoothstep(-.2,.25,dot(up,sun));
        float mu=max(0.0,dot(ray,sun));
        vec3 haze=tint*(.015+day*.8)+vec3(1.0,.82,.55)*pow(mu,40.0)*day*.12;
        if(inside)haze*=mix(.55,1.2,cloudLight)*exp(-max(0.0,radius-length(center))/scaleHeight*.025);
        float shake=distortion*(1.0-transmission);
        vec2 offset=vec2(sin(vUv.y*61.0+time*.8)+sin(vUv.x*37.0-time*.6),cos(vUv.x*53.0+time*.7))*shake;
        vec3 scene=texture2D(tDiffuse,clamp(vUv+offset,vec2(.001),vec2(.999))).rgb;
        gl_FragColor=vec4(mix(haze,scene,transmission),1.0);
      }`});
    this.universe=universe;this.state={body:null,transmission:1,altitude:null};
  }
  update(origin,time){
    const u=this.uniforms,U=this.universe;u.optical.value=0;this.state={body:null,transmission:1,altitude:null};
    let closest=Infinity;
    for(const body of U.localBodies||U.bodies){
      const p=atmosphereFor(body);if(!p)continue;
      const R=U.radius(body.id),factor=R/(body.radius*1000),center=new THREE.Vector3(...U.renderPositions[body.id]).sub(origin);
      const altitude=(center.length()-R)/factor;
      if(altitude>p.height||altitude>=closest)continue;closest=altitude;
      u.center.value.copy(center);u.radius.value=R;u.top.value=R+p.height*factor;
      u.scaleHeight.value=p.scale*factor;u.optical.value=p.optical;u.gas.value=isGasGiant(body)?1:0;u.tint.value.set(p.color);
      u.sun.value.copy(U.lightDirection(body.id));u.distortion.value=p.distortion;
      this.state={body:body.id,transmission:verticalTransmission(body,altitude),altitude};
    }
    u.inverseProjection.value.copy(U.camera.projectionMatrixInverse);u.cameraWorld.value.copy(U.camera.matrixWorld);
    u.logFar.value=Math.log2(U.camera.far+1);u.time.value=time;
  }
  render(renderer,writeBuffer,readBuffer,dt,mask){this.uniforms.tDepth.value=readBuffer.depthTexture;super.render(renderer,writeBuffer,readBuffer,dt,mask);}
}
