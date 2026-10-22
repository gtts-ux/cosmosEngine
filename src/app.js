import {isStar,hostStarId,systemName,currentSystem,bodiesInSystem,LIGHT_YEAR_KM} from './data/systems.js';
import { BODIES, BY_ID } from './data/catalog.js';
import { SimulationClock, AU, fromJulian } from './physics/orbits.js';
import { loadTextures } from './render/textures.js';
import { Universe, KM_PER_UNIT } from './render/universe.js';
import { Flight, speedLabel } from './navigation/flight.js';
import { canLand } from './data/shapes.js';

const $=id=>document.getElementById(id);
const thumbnailCache=new Map();
const format=(n,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
let universe,flight,settings,selected='earth',activeFilter='planets',hud=true,lastUI=0,fpsFrames=0,fpsTime=0,lastFrame=performance.now(),elapsed=0,measuredFPS=0;
let catalog=[...BODIES],byId={...BY_ID},browsingSystem='sun',hereSystem='sun',generationBusy=false,generationHost='sun';
const clock=new SimulationClock();
let toastTimer,saveTimer;
function toast(message){
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);
}
function thumb(el,body){
  el.style.backgroundColor=body.color;
  if(isStar(body)&&body.id!=='sun'){el.style.backgroundImage=`radial-gradient(circle at 35% 30%,#ffffff,${body.color} 45%,#241b28 100%)`;return;}
  let url=body.texture?`assets/textures/${body.texture}`:null;
  const image=universe?.textures.get(body.texture||body.id)?.image;
  if(image instanceof HTMLCanvasElement){
    if(!thumbnailCache.has(body.id)){const small=document.createElement('canvas');small.width=128;small.height=64;small.getContext('2d').drawImage(image,0,0,128,64);thumbnailCache.set(body.id,small.toDataURL('image/jpeg',.75));}
    url=thumbnailCache.get(body.id);
  }
  el.style.backgroundImage=url?`url("${url}")`:'none';
}
function bodyCategory(b){
  if(b.kind==='Natural satellite')return 'moons';
  if(b.kind==='Asteroid'||b.kind==='Dwarf planet')return 'small';
  return 'planets';
}
function buildBodyList(){
  $('body-list').replaceChildren();
  const members=bodiesInSystem(catalog,browsingSystem);
  const list=activeFilter==='stars'?catalog.filter(isStar):members.filter(b=>bodyCategory(b)===activeFilter);
  $('system-name').textContent=systemName(byId[browsingSystem]);$('system-select').value=browsingSystem;
  $('system-status').textContent=browsingSystem===hereSystem?'Current system':'Preview · click Go to';
  document.querySelector('.count').textContent=activeFilter==='stars'?`${list.length} STARS`:`${members.length} BODIES`;
  const generated=members.filter(b=>b.generated&&b.kind==='Planet').length;
  $('generate-system').disabled=generationBusy||members.some(b=>b.kind==='Planet');
  $('generate-planet').disabled=generationBusy||generated>=16;
  if(!list.length){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent=activeFilter==='planets'?'No planets in this catalog yet. Use ＋ Planet or Seed system to create fictional worlds here.':'No objects in this category for this system.';$('body-list').append(empty);}
  for(const [i,b] of list.entries()){
    const button=document.createElement('button');button.className=`body-row${b.id===selected?' active':''}`;button.dataset.body=b.id;
    button.setAttribute('aria-label',`Inspect ${b.name}`);button.setAttribute('aria-pressed',String(b.id===selected));
    const dot=document.createElement('span');dot.className='planet-dot';thumb(dot,b);
    const name=document.createElement('span');name.className='body-name';name.textContent=b.name;
    const index=document.createElement('span');index.className='body-index';index.textContent=b.id===selected?'●':String(i).padStart(2,'0');
    button.append(dot,name,index);button.addEventListener('click',()=>select(b.id));$('body-list').append(button);
  }
  if(activeFilter==='planets'&&list.length===1&&isStar(list[0])){const hint=document.createElement('p');hint.className='catalog-empty';hint.textContent='No planets loaded here. Seed system creates four fictional worlds, or add one with ＋ Planet.';$('body-list').append(hint);}
}
function setFilter(filter){
  activeFilter=filter;
  for(const button of document.querySelectorAll('[data-filter]')){
    const active=button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
  }
  buildBodyList();
}
function select(id){
  const b=byId[id];if(!b)return;
  selected=id;browsingSystem=hostStarId(b,byId);
  if(activeFilter!==bodyCategory(b))setFilter(bodyCategory(b));else buildBodyList();
  $('target-name').textContent=b.name;thumb($('target-thumb'),b);
  $('target-kind').textContent=b.generated?`Generated ${b.surfaceType} ${b.generatedMoon?'moon':'planet'}`:b.kind==='Planet'?(['jupiter','saturn'].includes(id)?'Gas giant':['uranus','neptune'].includes(id)?'Ice giant':'Terrestrial planet'):b.kind;
  $('target-description').textContent=b.description;
  $('target-radius').innerHTML=`${format(b.radius)} <small>km</small>`;
  $('target-gravity').innerHTML=`${format(b.gravity,2)} <small>m/s²</small>`;
  const [mantissa,exp]=b.mass.toExponential(2).split('e+');
  $('target-mass').innerHTML=`${mantissa} × 10<sup>${exp}</sup> <small>kg</small>`;
  $('target-period').innerHTML=b.period?`${format(b.period>730?b.period/365.25:b.period,1)} <small>${b.period>730?'years':'days'}</small>`:'<small>—</small>';
  $('target-atmosphere').textContent=b.atmosphere;
  $('target-note').textContent=b.kind==='Natural satellite'||b.kind==='Asteroid'||b.kind==='Dwarf planet'?'Simplified orbit · illustrative surface / phase':'Approximate ephemeris · J2000 frame';
  $('scene-title').textContent=b.name;
  $('scene-context').textContent=b.parent&&b.parent!=='sun'?`${byId[hostStarId(b,byId)].name.toUpperCase()} SYSTEM / ${b.kind.toUpperCase()}`:`SOL SYSTEM / ${$('target-kind').textContent.toUpperCase()}`;
  $('scene-subtitle').textContent=id==='earth'?'A familiar world. A different perspective.':id==='saturn'?'Countless fragments. One extraordinary world.':id==='sun'?'The light at the center of it all.':id==='europa'?'An ocean of possibility beneath the ice.':'Every world has a story. Get a little closer.';
  $('target-note').textContent=b.generated?(b.automatic?'FICTIONAL · Automatically populated':'FICTIONAL · Saved procedural world'):isStar(b)?'Catalog star · generated planets are fictional':$('target-note').textContent;
  $('land').textContent=canLand(b)?'↓ Land':'No solid surface';
  $('land').disabled=!canLand(b);
  $('land').title=canLand(b)?'Descend to this world':'Landing requires a solid surface';
  updateTargetDistance();
}
function updateTargetDistance(){
  if(!universe?.positions[selected])return;
  const body=byId[selected],point=universe.positions[selected];
  if(isStar(body)){
    $('distance-label').textContent='DISTANCE FROM SUN';$('target-distance').innerHTML=`${(Math.hypot(...point.map((v,i)=>v-universe.positions.sun[i]))/LIGHT_YEAR_KM).toFixed(2)} <small>ly</small>`;
  }else{
    const host=byId[hostStarId(body,byId)],origin=universe.positions[host.id];
    $('distance-label').textContent=`DISTANCE FROM ${host.name.toUpperCase()}`;
    $('target-distance').innerHTML=`${(Math.hypot(...point.map((v,i)=>v-origin[i]))/AU).toFixed(3)} <small>AU</small>`;
  }
}
function modeChanged(mode){
  $('speed-slider').disabled=mode==='land';
  $('mode-badge').textContent=mode==='orbit'?'ORBIT LOCKED':mode==='land'?'SURFACE VIEW':'INERTIAL FLIGHT';
  $('orbit-mode').classList.toggle('active',mode==='orbit');$('free-mode').classList.toggle('active',mode==='free');
  $('control-hint').innerHTML=mode==='land'?'<kbd>WASD</kbd> walk <span>·</span> <kbd>DRAG</kbd> look <span>·</span> <kbd>O</kbd> return to orbit':mode==='orbit'?'<kbd>DRAG</kbd> orbit <span>·</span> <kbd>SCROLL</kbd> zoom <span>·</span> <kbd>H</kbd> hide interface':'<kbd>WASD</kbd> thrust <span>·</span> <kbd>DRAG</kbd> look <span>·</span> <kbd>SCROLL</kbd> speed';
}
function applySettings(){
  universe.setSettings(settings);
  $('scale-name').textContent=settings.balanced?'Visually balanced':'True scale';
  $('scale-status').textContent=settings.balanced?'ENLARGED BODIES':'REALISTIC SCALE';
  $('orbits-toggle').classList.toggle('active',settings.orbitLines);
  $('labels-toggle').classList.toggle('active',settings.labels);
  $('orbit-lines').checked=settings.orbitLines;$('setting-labels').checked=settings.labels;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>window.cosmos.settings.save(settings).catch(()=>toast('Settings could not be saved. Check available disk space.')),200);
}
function toggleHUD(){hud=!hud;$('hud').hidden=!hud;$('show-hud').hidden=hud;}
function timeUI(){
  $('utc-date').textContent=fromJulian(clock.jd).toISOString().slice(0,19).replace('T','  ');
  $('julian-date').textContent=`JD ${clock.jd.toFixed(5)}`;
  $('time-rate').textContent=clock.paused?'PAUSED':`${format(Math.abs(clock.rate),3)}× ${Math.abs(clock.rate)===1?'REAL TIME':'TIME'}`;
  $('time-direction').textContent=clock.rate<0?'REVERSE':'FORWARD';
  $('pause').textContent=clock.paused?'▶':'Ⅱ';
  $('pause').setAttribute('aria-label',clock.paused?'Play simulation':'Pause simulation');
}
function changeRate(multiplier){
  clock.setRate(Math.sign(clock.rate||1)*Math.max(.001,Math.min(1e6,Math.abs(clock.rate||1)*multiplier)));
  timeUI();
}
function land(){
  if(!canLand(byId[selected])){toast('This body has no solid surface to land on.');return;}
  flight.visit(selected,false,'land');
  toast('Approaching the surface. WASD to walk, drag to look, O to return to orbit.');
}
function showSearch(){
  const query=$('search').value.trim().toLowerCase();const box=$('search-results');
  box.replaceChildren();
  if(!query){box.hidden=true;return;}
  const matches=catalog.filter(b=>[b.name,b.kind,...(b.aliases||[])].some(value=>value.toLowerCase().includes(query))); 
  for(const b of matches){
    const button=document.createElement('button');button.className='search-result';button.dataset.searchBody=b.id;
    const title=document.createElement('strong');title.textContent=b.name;
    const kind=document.createElement('span');kind.textContent=b.kind;
    button.append(title,kind);button.onclick=()=>{select(b.id);box.hidden=true;$('search').value='';$('search').blur();};box.append(button);
  }
  if(!matches.length){const p=document.createElement('p');p.className='no-results';p.textContent='No worlds found. Try Mars, Europa, or Ceres.';box.append(p);}
  box.hidden=false;
}
function buildSystemPicker(){
  $('system-select').replaceChildren();
  for(const star of catalog.filter(isStar)){const option=document.createElement('option');option.value=star.id;option.textContent=systemName(star);$('system-select').append(option);}
}
function updateSystemContext(){
  if(flight.warp)return;
  const next=currentSystem(flight.position.toArray().map((v,i)=>v*KM_PER_UNIT+universe.referenceAnchor[i]),catalog.filter(isStar));
  if(next!==hereSystem){hereSystem=next;if(next)universe.rebase(next,flight);else setFilter('stars');if(next&&hostStarId(byId[flight.target],byId)!==next)select(next);else if(next){browsingSystem=next;buildBodyList();}}
  $('current-system').textContent=hereSystem?`Here: ${systemName(byId[hereSystem])}`:'Here: Interstellar space';
  $('system-status').textContent=browsingSystem===hereSystem?'Current system':'Preview · click Go to';
}
async function generateWorlds(hostId,count=1,type='random',name='',seed=''){
  if(generationBusy)return;generationBusy=true;buildBodyList();$('generate-submit').disabled=true;
  try{
    const result=await window.cosmos.worlds.generate({hostId,count,type,name,seed});
    catalog.push(...result.bodies);for(const b of result.bodies)byId[b.id]=b;
    universe.addBodies(result.bodies);universe.updatePositions(clock.jd);createLabels();
    select(result.bodies[0].id);$('generate-dialog').close();
    toast(`Created ${result.bodies[0].name} and its moons. Saved locally · click Go to.`);
  }catch(error){toast(`Could not generate planet: ${error.message}`);}
  finally{generationBusy=false;$('generate-submit').disabled=false;buildBodyList();}
}
function attachUpdates(){
 let state={status:'idle'},poll;
 const paint=s=>{state=s;$('update-status').textContent=s.message;$('update-progress').hidden=s.status!=='downloading';$('update-progress').value=s.progress||0;
  const busy=['checking','downloading'].includes(s.status);$('update-action').disabled=busy;
  $('update-action').textContent=busy?s.status==='checking'?'Checking…':'Downloading…':s.status==='available'?'Download update':s.status==='ready'?'Open verified installer':'Check for updates';};
 $('update-button').addEventListener('click',async()=>{$('update-dialog').showModal();paint(await window.cosmos.updates.status());});
 $('update-action').addEventListener('click',async()=>{
  try{
   if(state.status==='ready'){await window.cosmos.updates.install();toast('Installer opened. Quit CosmosEngine, then replace it in Applications.');return;}
   const downloading=state.status==='available';paint({...state,status:downloading?'downloading':'checking',message:downloading?'Downloading and verifying the Mac installer…':'Checking GitHub for updates…'});
   poll=setInterval(async()=>{try{paint(await window.cosmos.updates.status());}catch{}},500);
   paint(await (downloading?window.cosmos.updates.download():window.cosmos.updates.check()));
  }catch(e){paint({...state,status:'error',message:e.message});}finally{clearInterval(poll);}
 });
}

function attachUI(){
  attachUpdates();
  $('system-select').onchange=e=>select(e.target.value);
  $('neighborhood-view').onclick=()=>{setFilter('stars');flight.neighborhood();$('scene-title').textContent='Local Neighborhood';$('scene-context').textContent='55 NEARBY CATALOG STARS / J2000 POSITIONS';$('scene-subtitle').textContent='Select a star to inspect its system. Go to to travel.';toast('Local neighborhood · select a star to inspect its system');};
  $('generate-planet').onclick=()=>{generationHost=browsingSystem;flight.keys.clear();flight.velocity.set(0,0,0);$('generate-form').reset();$('generate-host').textContent=`Orbiting ${byId[generationHost].name}`;$('generate-dialog').showModal();};
  $('generate-dialog').querySelector('.dialog-close').onclick=()=>$('generate-dialog').close();
  $('generate-form').onsubmit=e=>{e.preventDefault();generateWorlds(generationHost,1,$('generated-type').value,$('generated-name').value,$('generated-seed').value);};
  $('generate-system').onclick=()=>generateWorlds(browsingSystem,4,'random');
  for(const b of document.querySelectorAll('[data-window]'))b.onclick=()=>window.cosmos.window(b.dataset.window);
  for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>setFilter(b.dataset.filter);
  $('overview').onclick=()=>{const id=browsingSystem;select(id);flight.overview(id);if(!settings.orbitLines){settings.orbitLines=true;applySettings();}toast(`${systemName(byId[browsingSystem])} overview`);};
  $('warp').onclick=()=>flight.visit(selected);
  $('orbit').onclick=()=>flight.lock(selected);
  $('land').onclick=land;
  $('surface-exit').onclick=()=>flight.visit(universe.landing.body?.id||selected);
  $('telescope-zoom').onclick=()=>{flight.camera.zoom=1;flight.camera.updateProjectionMatrix();};
  $('orbit-mode').onclick=()=>flight.lock(selected);
  $('free-mode').onclick=()=>{flight.free();toast('WASD to fly · drag to look · scroll to change speed');};
  $('speed-slider').oninput=e=>flight.setSpeed(e.target.value);
  $('scale-toggle').onclick=()=>{
    const oldRadius=universe.radius(flight.target);
    settings.balanced=!settings.balanced;applySettings();universe.updatePositions(clock.jd);flight.rescale(oldRadius);
    toast(settings.balanced?'Bodies enlarged for visibility; heliocentric orbital distances preserved.':'Real planetary radii and orbital distances.');
  };
  $('orbits-toggle').onclick=()=>{settings.orbitLines=!settings.orbitLines;applySettings();};
  $('labels-toggle').onclick=()=>{settings.labels=!settings.labels;applySettings();};
  $('pause').onclick=()=>{clock.paused=!clock.paused;timeUI();};
  $('faster').onclick=()=>changeRate(10);$('slower').onclick=()=>changeRate(.1);
  $('reverse').onclick=()=>{clock.setRate(-clock.rate);timeUI();};
  $('realtime').onclick=()=>{clock.reset();timeUI();toast('Returned to the current UTC time.');};
  for(const b of document.querySelectorAll('[data-rate]'))b.onclick=()=>{clock.setRate(Number(b.dataset.rate)*Math.sign(clock.rate||1));clock.paused=false;timeUI();};
  for(const id of ['settings','help','update']){
    if(id!=='update')$(id+'-button').onclick=()=>{flight.keys.clear();flight.velocity.set(0,0,0);$(id+'-dialog').showModal();};
    $(id+'-dialog').querySelector('.dialog-close').onclick=()=>$(id+'-dialog').close();
    $(id+'-dialog').addEventListener('click',e=>{if(e.target===$(id+'-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  }
  for(const id of ['quality','bloom','exposure','stars','shadows','adaptive']){
    $(id)[['shadows','adaptive'].includes(id)?'checked':'value']=settings[id];
    $(id).oninput=e=>{settings[id]=['shadows','adaptive'].includes(id)?e.target.checked:id==='quality'?e.target.value:Number(e.target.value);applySettings();};
  }
  $('orbit-lines').onchange=e=>{settings.orbitLines=e.target.checked;applySettings();};
  $('setting-labels').onchange=e=>{settings.labels=e.target.checked;applySettings();};
  $('orbit-lines').checked=settings.orbitLines;$('setting-labels').checked=settings.labels;
  $('show-hud').onclick=toggleHUD;
  $('search').addEventListener('input',showSearch);
  $('search').addEventListener('keydown',e=>{
    if(e.key==='Enter'){$('search-results').querySelector('button')?.click();e.preventDefault();}
    if(e.key==='ArrowDown'){$('search-results').querySelector('button')?.focus();e.preventDefault();}
    if(e.key==='Escape'){$('search-results').hidden=true;$('search').blur();}
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-area'))$('search-results').hidden=true;});
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.code==='KeyK'){e.preventDefault();$('search').focus();return;}
    if(document.activeElement?.matches('input:not([type=range]):not([type=checkbox]),select,textarea')||document.querySelector('dialog[open]'))return;
    if(e.repeat)return;
    const actions={KeyF:()=>flight.free(),KeyO:()=>flight.visit(selected),KeyL:land,KeyG:()=>flight.visit(selected),KeyH:toggleHUD,KeyR:()=>{clock.reset();timeUI();},Space:()=>{clock.paused=!clock.paused;timeUI();}};
    if(actions[e.code]){e.preventDefault();actions[e.code]();}
  });
  window.addEventListener('resize',()=>universe.resize());
  document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();flight.keys.clear();flight.velocity.set(0,0,0);});
  $('universe').addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Graphics context lost. Reopen CosmosEngine to restore the scene.');});
}
const labelNodes=new Map();
function createLabels(){
  for(const b of catalog){
    if(labelNodes.has(b.id))continue;
    const el=document.createElement('button');el.className='object-label';el.textContent=b.name;el.setAttribute('aria-label',`Select ${b.name}`);el.onclick=()=>select(b.id);
    $('labels').append(el);labelNodes.set(b.id,el);
  }
}
function updateLabels(){
  const placed=[];
  for(const b of catalog){
    const el=labelNodes.get(b.id);if(!universe.nodes.get(b.id).group.visible){el.hidden=true;continue;}const p=settings.labels&&hud&&selected!==b.id?universe.project(b.id):null;
    // Reserve the panels and avoid a stack of unreadable labels at interstellar distances.
    const bodyPoint=universe.nodes.get(b.id).group.position;
    const selectedNode=universe.nodes.get(selected);
    const targetPoint=selectedNode.group.position;
    const direction=bodyPoint.clone().normalize(),along=targetPoint.dot(direction);
    const occluded=along>0 && along<bodyPoint.length() && targetPoint.clone().addScaledVector(direction,-along).length()<selectedNode.radius;
    const visible=p&&!occluded&&p.y>260&&p.y<innerHeight-235&&p.x>285&&p.x<innerWidth-295&&!placed.some(q=>p.x<q.x+q.width+8&&p.x+b.name.length*5.5+20>q.x&&Math.abs(p.y-q.y)<23);
    el.hidden=!visible;if(visible){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;placed.push({...p,width:b.name.length*5.5+12});}
  }
}
function frame(now){
  const actualDt=Math.max(0,(now-lastFrame)/1000),dt=Math.min(.1,actualDt);lastFrame=now;elapsed+=dt;
  if(!document.hidden){
    const boundary=clock.atBoundary;clock.step(actualDt);
    if(clock.atBoundary&&!boundary)toast('Time paused at the limit of the 1800–2050 orbital model.');
    universe.adaptResolution(actualDt,now);universe.updatePositions(clock.jd);flight.update(dt);universe.updateScene(clock.jd,elapsed,flight.position,flight);universe.render();
    fpsFrames++;fpsTime+=actualDt;
    if(now-lastUI>120){
      timeUI();updateSystemContext();updateTargetDistance();updateLabels();
      $('flight-speed').textContent=flight.mode==='land'?'5 m/s · walking':speedLabel(flight.speed);$('speed-slider').value=flight.speedExponent;
      const terrain=universe.landing;
      $('surface-panel').hidden=!terrain.visible;document.body.classList.toggle('is-land',terrain.visible);
      if(terrain.visible){$('surface-name').textContent=`${terrain.body.name} · ${terrain.profile.title}`;
        $('surface-coordinates').textContent=`${terrain.coordinates.latitude.toFixed(3)}° latitude · ${terrain.coordinates.longitude.toFixed(3)}° longitude`;}
      $('telescope-zoom').textContent=`Telescope ${flight.camera.zoom.toFixed(flight.camera.zoom<10?2:0)}×`;
      $('telescope-zoom').classList.toggle('active',flight.camera.zoom!==1);
      const center=universe.nodes.get(flight.target).group.position;
      const altitude=Math.max(0,(center.length()-universe.radius(flight.target))*KM_PER_UNIT);
      const near=universe.landing.near;
      $('altitude').textContent=near&&near.altitude<50000?`ALT ${format(Math.max(0,near.altitude),1)} m · ${near.body.name}`:`${flight.warp?'WARPING · ':''}ALT ${altitude>AU?`${format(altitude/AU,2)} AU`:`${format(altitude)} km`}`;
      if(fpsTime>.75){measuredFPS=Math.round(fpsFrames/fpsTime);$('fps').textContent=`${measuredFPS} FPS`;fpsFrames=0;fpsTime=0;}
      lastUI=now;
    }
  }
  requestAnimationFrame(frame);
}
async function main(){
  settings=await window.cosmos.settings.load();
  const bodies=await window.cosmos.catalog();
  const savedWorlds=await window.cosmos.worlds.load();
  catalog=[...BODIES,...savedWorlds.bodies];byId=Object.fromEntries(catalog.map(b=>[b.id,b]));
  if(bodies.length!==BODIES.length)throw new Error('The local celestial catalog is incomplete.');
  $('load-message').textContent='Loading planetary maps…';
  const textures=await loadTextures(catalog,progress=>{$('load-progress').style.width=`${progress*85}%`;});
  $('load-message').textContent='Starting the WebGL 2 observatory…';
  universe=new Universe($('universe'),catalog,textures,settings);
  universe.onTextureReady=body=>{thumbnailCache.delete(body.id);const row=document.querySelector(`[data-body="${body.id}"] .planet-dot`);if(row)thumb(row,body);if(selected===body.id)thumb($('target-thumb'),body);};
  universe.updatePositions(clock.jd);
  flight=new Flight(universe,$('universe'),modeChanged,id=>select(id));
  document.querySelector('.count').textContent=`${BODIES.length} OBJECTS`;
  flight.visit('earth',true);universe.updateScene(clock.jd,0,flight.position);
  buildSystemPicker();attachUI();createLabels();select('earth');applySettings();timeUI();
  // Compile before removing the loading screen to expose shader failures early.
  universe.render();
  if(universe.shaderError)throw new Error('A graphics shader could not compile on this GPU.');
  $('load-progress').style.width='100%';$('loading').hidden=true;
  window.__cosmos={
    ready:true,
    diagnostics:()=>({...universe.getDiagnostics(),selected,browsingSystem,currentSystem:hereSystem,visibleCatalog:[...document.querySelectorAll('[data-body]')].map(b=>b.dataset.body),automaticBodies:catalog.filter(b=>b.automatic).length,generatedMoons:catalog.filter(b=>b.generatedMoon).length,generated:catalog.filter(b=>b.generated&&!b.automatic&&!b.generatedMoon).map(b=>({id:b.id,name:b.name,parent:b.parent,surfaceType:b.surfaceType,seed:b.seed})),mode:flight.mode,jd:clock.jd,rate:clock.rate,paused:clock.paused,
      flightTarget:flight.target,sunspotRegions:14,position:flight.position.toArray(),zoom:flight.camera.zoom,effectiveFOV:flight.camera.getEffectiveFOV(),speed:flight.speed,settings:{...settings},warp:!!flight.warp,fps:measuredFPS}),
  };
  if((await window.cosmos.version()).testing){
    window.__cosmos.starProbe=()=>{
      const points=universe.starIds.map(id=>({id,p:universe.project(id)})).filter(s=>s.p);
      const gl=universe.renderer.getContext(),ratio=universe.renderer.getPixelRatio();
      const read=()=>points.map(({p})=>{
        const pixels=new Uint8Array(9*9*4);
        const x=Math.max(0,Math.min(gl.drawingBufferWidth-9,Math.floor(p.x*ratio)-4));
        const y=Math.max(0,Math.min(gl.drawingBufferHeight-9,Math.floor((innerHeight-p.y)*ratio)-4));
        gl.readPixels(x,y,9,9,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      });
      universe.nearbyStars.visible=false;universe.render();const background=read();
      universe.nearbyStars.visible=true;universe.render();const stars=read();
      return points.map((s,i)=>({id:s.id,brightness:Math.max(...stars[i].map((v,j)=>j%4===3?0:v-background[i][j]))}));
    };
    window.__cosmos.gasFlight=async(id,fraction=1.02)=>{
      const {Vector3}=await import('three');const node=universe.nodes.get(id);
      select(id);universe.rebase(node.hostId,flight);flight.target=id;flight.free();
      const direction=universe.lightDirection(id),center=new Vector3(...universe.renderPositions[id]);
      flight.position.copy(center).addScaledVector(direction,universe.radius(id)*fraction);
      flight.camera.lookAt(direction.clone().negate());flight.velocity.set(0,0,0);flight.surfaceFrame=null;
      flight.setSpeed(Math.log10(node.body.radius*1000*.3));
    };
    window.__cosmos.bodyProbe=id=>{
      const n=universe.nodes.get(id),R=universe.radius(id);
      const p=n.mesh.geometry.attributes.position;let low=Infinity,high=-Infinity;
      for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getY(i),p.getZ(i));low=Math.min(low,r);high=Math.max(high,r);}
      return {fraction:n.group.position.length()/R,mesh:n.mesh.visible,mode:flight.mode,
        textureWidth:n.uniforms.dayMap.value.image.width,rangeMeters:(high-low)*n.body.radius*1000,resolution:n.terrainResolution||0,
        groundVertices:universe.landing.ground?.geometry.attributes.position.count||0};
    };
    window.__cosmos.placeSunlit=async(id,altitude=100,lookDown=false)=>{
      const {Vector3}=await import('three');const {surfaceCoordinates}=await import('./data/geography.js');
      const d=universe.lightDirection(id).applyQuaternion(universe.landing.bodyRotation(id).invert());
      const c=surfaceCoordinates(d.toArray());await window.__cosmos.place(id,c.latitude,c.longitude,altitude,lookDown);
    };
    window.__cosmos.sunspotProbe=async()=>{
      const {Vector3}=await import('three');universe.render();const gl=universe.renderer.getContext(),node=universe.nodes.get('sun');
      const direction=node.group.position.clone().negate().normalize(),rotation=universe.landing.bodyRotation('sun');
      const pixel=p=>{const point=node.mesh.localToWorld(p.clone()).project(universe.camera),out=new Uint8Array(4);
        gl.readPixels(Math.floor((point.x*.5+.5)*gl.drawingBufferWidth),Math.floor((point.y*.5+.5)*gl.drawingBufferHeight),1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return out[0]+out[1]+out[2];};
      const samples=[];for(let k=0;k<14;k++){const lon=k*2.399963,lat=Math.sin(k*7.13)*.43,C=new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
        if(C.clone().applyQuaternion(rotation).dot(direction)<.4)continue;
        const neighbor=C.clone().addScaledVector(new Vector3(-C.z,0,C.x).normalize(),.12).normalize();
        samples.push({spot:pixel(C),surface:pixel(neighbor)});}
      return samples;
    };
    window.__cosmos.frameProbe=()=>{
      universe.render();const gl=universe.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      return [.2,.5,.8].map(y=>{const pixel=new Uint8Array(4);gl.readPixels(Math.floor(w*.5),Math.floor(h*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];});
    };
    window.__cosmos.tryLanding=id=>flight.visit(id,false,'land');
    window.__cosmos.place=async(id,latitude,longitude,altitude=1000,lookDown=false)=>{
      const {surfaceDirection}=await import('./data/geography.js');
      const {Vector3,Quaternion,Euler}=await import('three');
      select(id);universe.rebase(universe.nodes.get(id).hostId,flight);flight.target=id;flight.free();
      await universe.ensureTexture(byId[id],2048);
      const landing=universe.landing,body=byId[id],local=new Vector3(...surfaceDirection(latitude,longitude)),q=landing.bodyRotation(id);
      const sample=landing.sample(body,local),factor=universe.radius(id)/(body.radius*1000);
      flight.position.fromArray(universe.renderPositions[id]).addScaledVector(local.clone().applyQuaternion(q),universe.radius(id)+(sample.height+altitude)*factor);
      flight.camera.quaternion.copy(q).multiply(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),local)).multiply(new Quaternion().setFromEuler(new Euler(lookDown?-Math.PI/2:-.12,0,0)));
      flight.velocity.set(0,0,0);flight.surfaceFrame=null;flight.followSurface();
    };
  }
  requestAnimationFrame(frame);
}
main().catch(error=>{
  console.error(error);$('load-message').textContent=`Unable to start: ${error.message}`;
  $('load-progress').style.background='#f09184';
});
