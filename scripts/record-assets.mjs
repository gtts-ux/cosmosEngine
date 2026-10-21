// Maintainer utility: record the already-reviewed source URLs and source hashes.
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { TEXTURES,BY_ID } from '../src/data/catalog.js';
const layers={io:'SSI_VGR_color',europa:'GALILEO_VOYAGER',ganymede:'GALILEO_VOYAGER',callisto:'GALILEO_VOYAGER',titan:'CASSINI',enceladus:'CASSINI',mimas:'CASSINI_MIMAS_MOSAIC',tethys:'CASSINI',dione:'CASSINI_VOYAGER',rhea:'CASSINI_VOYAGER',iapetus:'CASSINI_VOYAGER',triton:'TRITON_VOYAGER2',charon:'NEWHORIZONS_CHARON_MOSAIC',phobos:'VIKING',deimos:'VIKING'};
layers.ceres='Ceres_FC_global';layers.vesta='Dawn_HAMO_global';
const ground={grass:'aerial_grass_rock',sand:'coast_sand_02',rock:'rocky_terrain_02',ice:'snow_02'};
const entries=[];
for(const file of [...new Set(TEXTURES)]){
  let url,credit,sourceFile=file,convertToPng=false;
  if(file.startsWith('ground-')){
    const [,type,map]=file.replace('.jpg','').split('-'),asset=ground[type];
    const suffix={color:'diff',normal:'nor_gl',rough:'rough'}[map];
    url=`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${asset}/${asset}_${suffix}_1k.jpg`;credit='Poly Haven / CC0';
  }else if(file.endsWith('-usgs.jpg')){
    const id=file.replace('-usgs.jpg','');
    const directory=['ceres','vesta'].includes(id)?'asteroid_belt':BY_ID[id].parent;
    url=`https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/${directory}/${id}_simp_cyl.map&SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${layers[id]}&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg`;
    credit='NASA mission imagery / USGS Astrogeology global mosaic';
  }else if(file==='pluto-nasa.jpg'){
    url='https://images-assets.nasa.gov/image/PIA11707/PIA11707~orig.jpg';credit='NASA/JHUAPL/SwRI / New Horizons, PIA11707';
  }else{
    if(file==='earth-normal.png'){sourceFile='2k_earth_normal_map.tif';convertToPng=true;}
    if(file==='earth-specular.png'){sourceFile='2k_earth_specular_map.tif';convertToPng=true;}
    url=`https://www.solarsystemscope.com/textures/download/${sourceFile}`;credit='Solar System Scope / INOVE / CC BY 4.0';
  }
  const source=await readFile(`assets/textures/${sourceFile}`),output=await readFile(`assets/textures/${file}`);
  entries.push({file,url,sha256:createHash('sha256').update(source).digest('hex'),outputSha256:createHash('sha256').update(output).digest('hex'),...(convertToPng?{convertToPng:true}:{}),credit});
}
await writeFile('assets/manifest.json',JSON.stringify(entries,null,2)+'\n');console.log(`Recorded ${entries.length} licensed assets.`);
