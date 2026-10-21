import * as THREE from 'three';
export function proceduralTexture(body) {
  const w=1024,h=512,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h),base=new THREE.Color(body.color);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,u=x/w*Math.PI*2,v=y/h*Math.PI;
    const n=Math.sin(u*19+Math.sin(v*21)*2)*Math.sin(v*37+Math.cos(u*11));
    let f=.72+.12*n+.08*Math.sin(u*53+v*71);
    if(body.procedural==='ice'){
      const crack=Math.abs(Math.sin(u*8+Math.sin(v*13)*2.6));
      f=crack<.055?.39:.86+n*.06;
    }
    if(body.procedural==='haze')f=.85+Math.sin(v*19)*.025;
    if(body.procedural==='volcanic')f=Math.sin(u*31+v*19)>.94?.25:.8+n*.16;
    image.data[i]=Math.min(255,base.r*255*f);
    image.data[i+1]=Math.min(255,base.g*255*f);
    image.data[i+2]=Math.min(255,base.b*255*f);
    image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function solidTexture(r,g,b) {
  const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1);t.needsUpdate=true;return t;
}
export async function loadTextures(bodies,onProgress) {
  const textures=new Map(),loader=new THREE.TextureLoader();
  const names=[...new Set([...bodies.map(b=>b.texture).filter(Boolean),'2k_earth_nightmap.jpg','2k_earth_clouds.jpg','earth-normal.png','earth-specular.png','2k_stars_milky_way.jpg'])];
  let done=0;
  await Promise.all(names.map(async name=>{
    const url=await window.cosmos.texture(name);
    const t=await loader.loadAsync(url);
    if(!name.includes('normal')&&!name.includes('specular')&&!name.includes('clouds'))t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;textures.set(name,t);onProgress(++done/names.length);
  }));
  for(const b of bodies)if(!b.texture)textures.set(b.id,proceduralTexture(b));
  return textures;
}
