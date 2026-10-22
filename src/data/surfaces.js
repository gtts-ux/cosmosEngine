export const GAS_GIANTS = new Set(['jupiter','saturn','uranus','neptune']);
export const GROUND_TEXTURES = ['grass','sand','rock','ice'].flatMap(type=>
  ['color','normal','rough'].map(map=>`ground-${type}-${map}.jpg`));
const ice = {type:'ice',title:'Fractured water ice',tint:'#b4c4ce',relief:22,air:0};
const rock = {type:'rock',title:'Cratered regolith',tint:'#97928a',relief:18,air:0};
const profiles = {
  earth:{type:'grass',title:'Temperate grassland',tint:'#b4c692',relief:6,air:1},
  mercury:{...rock,tint:'#a69d91',title:'Sun-baked regolith',relief:24},
  venus:{...rock,tint:'#b98a50',title:'Volcanic basalt plains',air:2,relief:12},
  mars:{...rock,tint:'#cf7950',title:'Iron-rich dust and rock',air:.3,relief:16},
  moon:{...rock,tint:'#a7a7a4',title:'Lunar regolith'},
  io:{type:'volcanic',title:'Sulfur plains and lava fissures',tint:'#d8b250',relief:14,air:0},
  europa:{...ice,title:'Fractured ice and dark lineae',tint:'#cec5ae'},
  ganymede:{...ice,title:'Grooved ice and rocky ridges',tint:'#aaa495',relief:30},
  callisto:{...rock,title:'Ancient cratered ice',tint:'#827d72',relief:26},
  titan:{type:'sand',title:'Hydrocarbon dunes and methane lakes',tint:'#a4763f',relief:14,air:2},
  triton:{...ice,title:'Nitrogen frost',tint:'#c0bbb5',relief:8},
  enceladus:{...ice,title:'Bright ice and tiger-stripe fractures',tint:'#d9e4e8',relief:18},
  iapetus:{...rock,title:'Dark icy regolith',tint:'#83796b',relief:28},
  pluto:{...ice,title:'Nitrogen ice and tholin deposits',tint:'#c9b09a',relief:18,air:.1},
  charon:{...ice,title:'Water ice and dark polar material',tint:'#b3afb0',relief:32},
  ceres:{...rock,title:'Dark regolith and salt deposits',tint:'#99958b',relief:24},
  eris:{...ice,title:'Methane and nitrogen frost',tint:'#d8d9db',relief:10},
  haumea:{...ice,title:'Crystalline water ice',tint:'#c3d0d5',relief:16},
  makemake:{...ice,title:'Methane frost and reddish deposits',tint:'#c7ae96',relief:12},
};
export function surfaceProfile(body,biome='grass') {
  if(body.generated){
    if(body.surfaceType==='gas')return {type:'cloud',title:'Generated cloud atmosphere',tint:body.color,relief:0,air:2};
    if(body.surfaceType==='ice')return {...ice,title:'Generated ice and frost'};
    if(body.surfaceType==='ocean'){
      if(biome==='water')return {type:'water',title:'Generated ocean',tint:'#156477',relief:0,air:1};
      if(biome==='sand')return {type:'sand',title:'Generated coast and sand',tint:'#c5af80',relief:5,air:1};
      if(biome==='ice')return {...ice,title:'Generated polar ice',air:1};
      return {type:'grass',title:'Generated vegetation',tint:body.color,relief:7,air:1};
    }
    return {...rock,title:'Generated rocky terrain',tint:body.color,air:.3};
  }
  if(GAS_GIANTS.has(body.id))return {type:'cloud',title:'Turbulent cloud tops',tint:body.color,relief:160,air:2};
  if(body.id==='earth') {
    if(biome==='sand')return {type:'sand',title:'Sand and desert',tint:'#e9d5aa',relief:4,air:1};
    if(biome==='water')return {type:'water',title:'Open ocean',tint:'#156477',relief:0,air:1};
  }
  return {...(profiles[body.id] || (body.kind==='Natural satellite'&&body.parent!=='mars'?ice:rock))};
}
export function seedFor(text) {let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z,seed) {let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
export function noise2(x,z,seed) {
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),u),mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),u),v);
}
export function terrainHeight(x,z,profile,seed) {
  if(profile.type==='water')return 0;
  const broad=(noise2(x/600,z/600,seed)-.5)*profile.relief*2;
  const fine=(noise2(x/70,z/70,seed+13)-.5)*profile.relief*.18;
  if(profile.type==='cloud')return broad+fine;
  if(profile.type==='ice')return broad+fine-Math.exp(-Math.abs(Math.sin(x/180+Math.sin(z/350)))*25)*4;
  if(profile.type==='rock') {
    const cx=Math.floor(x/650),cz=Math.floor(z/650);let crater=0;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
      const px=(cx+i+hash(cx+i,cz+j,seed))*650,pz=(cz+j+hash(cx+i,cz+j,seed+9))*650;
      const r=60+hash(cx+i,cz+j,seed+7)*130,d=Math.hypot(x-px,z-pz)/r;
      if(d<1.3)crater+=(-Math.max(0,1-d*d)*.5+Math.exp(-(((d-1)*7)**2))*.16)*r;
    }
    return broad+fine+crater;
  }
  return broad+fine;
}
export function terrainExtent(body) {return Math.min(24000,body.radius*1000*.2);}
