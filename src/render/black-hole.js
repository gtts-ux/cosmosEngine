import * as THREE from 'three';
import {sphereVertex} from './shaders.js';
export function addBlackHole(node){
 node.mesh.material.dispose();node.mesh.material=new THREE.MeshBasicMaterial({color:0x000000});
 // Optically thick horizon with an illustrative hot disk and photon ring.
 const material=new THREE.ShaderMaterial({vertexShader:sphereVertex,side:THREE.DoubleSide,transparent:true,depthWrite:false,
  uniforms:{time:node.uniforms.time},fragmentShader:`
 #include <common>
 #include <logdepthbuf_pars_fragment>
 uniform float time;varying vec2 vUv;
 void main(){
  #include <logdepthbuf_fragment>
  vec2 p=(vUv-.5)*40.0;float r=length(p);if(r<2.7||r>19.0)discard;
  float angle=atan(p.y,p.x),stream=sin(angle*19.0-r*7.0+time*.8)*sin(angle*7.0+r*13.0-time*.45);
  float hot=pow(3.0/r,1.8),ring=exp(-pow((r-2.9)/.18,2.0));
  vec3 c=mix(vec3(1,.18,.018),vec3(1,.9,.7),hot)*(.65+stream*.25)*(1.0-smoothstep(12.0,19.0,r));
  gl_FragColor=vec4(c*(hot*5.0+ring*3.0),.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 node.disk=new THREE.Mesh(new THREE.PlaneGeometry(40,40),material);node.disk.rotation.x=-Math.PI*.32;node.group.add(node.disk);
}
