import * as THREE from 'three';
import { shapeFactor } from '../data/shapes.js';
import { surfaceCoordinates,earthBiome } from '../data/geography.js';
import { surfaceProfile,terrainHeight,seedFor } from '../data/surfaces.js';

// Lazily read the same albedo image displayed on the globe. Keep at most two CPU atlases.
export class SurfaceAtlas {
  constructor(universe){this.universe=universe;this.cache=new Map();}
  pixels(body){
    if(this.cache.has(body.id))return this.cache.get(body.id);
    const image=this.universe.textures.get(body.texture||body.id).image;
    const canvas=document.createElement('canvas');canvas.width=Math.min(4096,image.width);canvas.height=Math.round(canvas.width*image.height/image.width);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const atlas={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
    if(this.cache.size>=2)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(body.id,atlas);return atlas;
  }
  sample(body,direction){
    const coords=surfaceCoordinates(direction.toArray()),a=this.pixels(body);
    const x=Math.min(a.width-1,Math.floor(coords.u*a.width)),y=Math.min(a.height-1,Math.floor(coords.v*a.height));
    const i=(y*a.width+x)*4,rgb=[a.data[i],a.data[i+1],a.data[i+2]];
    const biome=(body.id==='earth'||body.surfaceType==='ocean')?earthBiome(rgb):null;
    let profile=surfaceProfile(body,biome);
    if(body.id==='earth'&&biome==='ice')profile={type:'ice',title:'Snow and ice',tint:'#d9e1e4',relief:8,air:1};
    if(body.id==='earth'&&biome==='rock')profile={type:'rock',title:'Rocky terrain',tint:'#a39e8f',relief:12,air:1};
    const color=new THREE.Color().setRGB(...rgb.map(c=>c/255),THREE.SRGBColorSpace);
    if(body.id==='moon'){const l=(color.r+color.g+color.b)/3;color.setRGB(l,l,l);}
    // A fixed body-coordinate field survives tile recentering, revisits and rotation.
    // Blended projections avoid longitude seams and polar singularities in microrelief.
    const R=body.radius*1000,d=direction.clone().normalize().multiplyScalar(R),seed=seedFor(body.id);
    const heights=profile.type==='water'?0:(terrainHeight(d.x,d.z,profile,seed)+terrainHeight(d.y,d.x,profile,seed+91)+terrainHeight(d.z,d.y,profile,seed+237))/3;
    return {...coords,rgb,color,profile,height:heights+(shapeFactor(body,direction.toArray())-1)*R};
  }
}
