import * as THREE from 'three';
import {noise2,seedFor} from '../data/surfaces.js';
export function proceduralTexture(body) {
  const w=body.generated?2048:1024,h=w/2,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(w,h);
  const base=new THREE.Color(body.color).getRGB({},THREE.SRGBColorSpace),seed=seedFor(body.id);
  const craters=Array.from({length:32},(_,i)=>{
    const y=noise2(i,0,seed)*2-1,a=i*2.399963,r=Math.sqrt(1-y*y);
    return {x:r*Math.cos(a),y,z:r*Math.sin(a),size:.018+noise2(i,1,seed)*.16};
  });
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,u=x/w*Math.PI*2,v=y/(h-1)*Math.PI;
    const X=-Math.cos(u)*Math.sin(v),Y=Math.cos(v),Z=Math.sin(u)*Math.sin(v);
    let f=.76;
    for(const [scale,amplitude] of [[3,.3],[11,.15],[37,.07],[119,.025]]){
      const warp=noise2(Y*scale,Z*scale,seed+3)-.5;
      f+=(noise2(X*scale+warp,Z*scale+Y*scale*.7,seed)-.5)*amplitude;
    }
    for(const c of (body.surfaceType==='gas'?[]:craters)){
      const distance2=2-2*(X*c.x+Y*c.y+Z*c.z);
      if(distance2>(c.size*1.2)**2)continue;
      const d=Math.sqrt(Math.max(0,distance2))/c.size;
      if(d<1.2)f+=-.19*Math.max(0,1-d*d)+.1*Math.exp(-(((d-1)*12)**2));
    }
    if(body.procedural==='ice')f+=.08;
    if(body.generated&&body.surfaceType==='gas'){
      const curl=noise2(X*12+Y*3,Z*12,seed+29),bands=Math.sin(Y*65+curl*4+Math.sin(Z*7)*.5);
      f=.88+bands*.14+(noise2(X*170,Y*170+Z*90,seed+18)-.5)*.07;
    }
    if(body.generated&&body.surfaceType==='ocean'){
      const continent=noise2(X*3+noise2(Y*4,Z*4,seed+5),Z*3+Y*2,seed+17)*.8+noise2(X*17+Y*4,Z*17,seed+71)*.14+noise2(X*67+Y*13,Z*67,seed+91)*.06;
      const detail=noise2(X*180+Y*33,Z*180,seed+31),aridity=noise2(X*9+Y*4,Z*9,seed+44);
      const mixRGB=(a,b,t)=>a.map((c,k)=>c+(b[k]-c)*Math.max(0,Math.min(1,t)));
      let rgb;
      if(continent<.5){
        rgb=mixRGB([8,24,56],[29,112,134],Math.pow(Math.max(0,(continent-.25)/.25),4));
      }else{
        const inland=Math.min(1,(continent-.5)/.025);
        const vegetation=mixRGB([37,61,34],[99,106,61],aridity);
        rgb=mixRGB([178,163,121],vegetation,inland);
        const snow=Math.max(0,(Math.abs(Y)+noise2(X*13,Z*13,seed+81)*.07-.84)/.09);
        rgb=mixRGB(rgb,[222,232,234],snow);
      }
      const shade=.93+(f-.76)*.4+(detail-.5)*.11;
      for(let c=0;c<3;c++)image.data[i+c]=rgb[c]*shade;
      image.data[i+3]=255;continue;
    }
    // Mineral variation and fractured frost at several scales, retaining each
    // body's characteristic palette instead of uniformly tinting the whole globe.
    const mineral=noise2(X*23+Y*7,Z*23,seed+301)-.5;
    if(body.procedural==='ice')f+=Math.pow(1-Math.abs(Math.sin(X*46+Y*29+noise2(Y*8,Z*8,seed)*4)),30)*-.09;
    image.data[i]=Math.min(245,base.r*255*(f+mineral*.1));image.data[i+1]=Math.min(245,base.g*255*f);image.data[i+2]=Math.min(245,base.b*255*f);image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;return t;
}
// Some spacecraft mosaics use edge-connected pure white for unsurveyed areas.
// Preserve measured pixels; fill only that mask with a documented reconstruction.
export function repairNoData(texture,body){
  const image=texture.image,w=image.width,h=image.height,n=w*h;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,mask=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  const push=i=>{if(i<0||i>=n||mask[i])return;const j=i*4;if(Math.min(data[j],data[j+1],data[j+2])<249)return;mask[i]=1;queue[tail++]=i;};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(head<tail){const i=queue[head++],x=i%w;push(i-w);push(i+w);if(x)push(i-1);if(x<w-1)push(i+1);}
  if(tail<4096)return texture;
  const fallback=proceduralTexture(body),fill=document.createElement('canvas');fill.width=w;fill.height=h;
  const fctx=fill.getContext('2d');fctx.drawImage(fallback.image,0,0,w,h);const fd=fctx.getImageData(0,0,w,h).data;
  // Blend into the closest measured boundary over the first 24 missing pixels.
  const distance=new Uint16Array(n),nearest=new Int32Array(n);head=0;let count=0;
  for(let k=0;k<tail;k++){
    const i=queue[k],x=i%w;
    const valid=[i-w,i+w,x?i-1:-1,x<w-1?i+1:-1].find(j=>j>=0&&j<n&&!mask[j]);
    if(valid!==undefined){distance[i]=1;nearest[i]=valid;queue[count++]=i;}
  }
  while(head<count){const i=queue[head++],x=i%w;
    for(const j of [i-w,i+w,x?i-1:-1,x<w-1?i+1:-1])if(j>=0&&j<n&&mask[j]&&!distance[j]){distance[j]=distance[i]+1;nearest[j]=nearest[i];queue[count++]=j;}
  }
  let repaired=0;
  for(let i=0;i<n;i++)if(mask[i]){const blend=Math.min(1,(distance[i]||100)/24),j=i*4,k=nearest[i]*4;for(let c=0;c<3;c++)data[j+c]=data[k+c]*(1-blend)+fd[j+c]*blend;repaired++;}
  ctx.putImageData(pixels,0,0);fallback.dispose();
  const result=new THREE.CanvasTexture(canvas);result.colorSpace=THREE.SRGBColorSpace;result.userData.repairedPixels=repaired;
  texture.dispose();return result;
}
export function solidTexture(r,g,b){const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1);t.needsUpdate=true;return t;}
export async function loadTextures(bodies,onProgress){
  const textures=new Map(),loader=new THREE.TextureLoader();
  const names=[...new Set([...bodies.map(b=>b.texture).filter(Boolean),'2k_earth_nightmap.jpg','2k_earth_clouds.jpg','earth-normal.png','earth-specular.png','2k_stars_milky_way.jpg'])];let done=0;
  await Promise.all(names.map(async name=>{
    const url=await window.cosmos.texture(name);let t=await loader.loadAsync(url);
    if(name.endsWith('-usgs.jpg'))t=repairNoData(t,bodies.find(b=>b.texture===name));
    if(!name.includes('normal')&&!name.includes('specular')&&!name.includes('clouds'))t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=8;
    textures.set(name,t);onProgress(++done/names.length);
  }));
  for(const b of bodies)if(!b.texture)textures.set(b.id,proceduralTexture(b));return textures;
}
