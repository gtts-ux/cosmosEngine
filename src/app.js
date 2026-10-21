import { BODIES, BY_ID } from './data/catalog.js';
import { SimulationClock, AU, fromJulian } from './physics/orbits.js';
import { loadTextures } from './render/textures.js';
import { Universe, KM_PER_UNIT } from './render/universe.js';
import { Flight, speedLabel } from './navigation/flight.js';
import { GAS_GIANTS } from './data/surfaces.js';

const $=id=>document.getElementById(id);
const format=(n,d=0)=>n.toLocaleString('en-US',{maximumFractionDigits:d});
let universe,flight,settings,selected='earth',activeFilter='planets',hud=true,lastUI=0,fpsFrames=0,fpsTime=0,lastFrame=performance.now(),elapsed=0,measuredFPS=0;
const clock=new SimulationClock();
let toastTimer,saveTimer;
function toast(message){
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);
}
function thumb(el,body){
  el.style.backgroundColor=body.color;
  el.style.backgroundImage=body.texture?`url("assets/textures/${body.texture}")`:'none';
}
function bodyCategory(b){
  if(b.kind==='Natural satellite')return 'moons';
  if(b.kind==='Asteroid'||b.kind==='Dwarf planet')return 'small';
  return 'planets';
}
function buildBodyList(){
  $('body-list').replaceChildren();
  const list=BODIES.filter(b=>bodyCategory(b)===activeFilter);
  for(const [i,b] of list.entries()){
    const button=document.createElement('button');button.className=`body-row${b.id===selected?' active':''}`;button.dataset.body=b.id;
    button.setAttribute('aria-label',`Inspect ${b.name}`);button.setAttribute('aria-pressed',String(b.id===selected));
    const dot=document.createElement('span');dot.className='planet-dot';thumb(dot,b);
    const name=document.createElement('span');name.className='body-name';name.textContent=b.name;
    const index=document.createElement('span');index.className='body-index';index.textContent=b.id===selected?'●':String(i).padStart(2,'0');
    button.append(dot,name,index);button.addEventListener('click',()=>select(b.id,true));$('body-list').append(button);
  }
}
function setFilter(filter){
  activeFilter=filter;
  for(const button of document.querySelectorAll('[data-filter]')){
    const active=button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
  }
  buildBodyList();
}
function select(id,travel=false){
  const b=BY_ID[id];if(!b)return;
  selected=id;
  if(activeFilter!==bodyCategory(b))setFilter(bodyCategory(b));else buildBodyList();
  $('target-name').textContent=b.name;thumb($('target-thumb'),b);
  $('target-kind').textContent=b.kind==='Planet'?(['jupiter','saturn'].includes(id)?'Gas giant':['uranus','neptune'].includes(id)?'Ice giant':'Terrestrial planet'):b.kind;
  $('target-description').textContent=b.description;
  $('target-radius').innerHTML=`${format(b.radius)} <small>km</small>`;
  $('target-gravity').innerHTML=`${format(b.gravity,2)} <small>m/s²</small>`;
  const [mantissa,exp]=b.mass.toExponential(2).split('e+');
  $('target-mass').innerHTML=`${mantissa} × 10<sup>${exp}</sup> <small>kg</small>`;
  $('target-period').innerHTML=b.period?`${format(b.period>730?b.period/365.25:b.period,1)} <small>${b.period>730?'years':'days'}</small>`:'<small>—</small>';
  $('target-atmosphere').textContent=b.atmosphere;
  $('target-note').textContent=b.kind==='Natural satellite'||b.kind==='Asteroid'||b.kind==='Dwarf planet'?'Simplified orbit · illustrative surface / phase':'Approximate ephemeris · J2000 frame';
  $('scene-title').textContent=b.name;
  $('scene-context').textContent=b.parent&&b.parent!=='sun'?`${BY_ID[b.parent].name.toUpperCase()} SYSTEM / NATURAL SATELLITE`:`SOL SYSTEM / ${$('target-kind').textContent.toUpperCase()}`;
  $('scene-subtitle').textContent=id==='earth'?'A familiar world. A different perspective.':id==='saturn'?'Countless fragments. One extraordinary world.':id==='sun'?'The light at the center of it all.':id==='europa'?'An ocean of possibility beneath the ice.':'Every world has a story. Get a little closer.';
  $('land').textContent=GAS_GIANTS.has(id)?'↓ Cloud tops':'↓ Land';
  $('land').disabled=id==='sun';
  if(travel)flight.visit(id);
  updateTargetDistance();
}
function updateTargetDistance(){
  if(!universe?.positions[selected])return;
  const distance=Math.hypot(...universe.positions[selected])/AU;
  $('target-distance').innerHTML=`${distance.toFixed(3)} <small>AU</small>`;
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
  if(selected==='sun'){toast('Surface landing is unavailable for the Sun.');return;}
  flight.visit(selected,false,'land');
  toast(GAS_GIANTS.has(selected)?'Approaching the cloud tops. Press O to return to orbit.':'Approaching the surface. WASD to walk, drag to look, O to return to orbit.');
}
function showSearch(){
  const query=$('search').value.trim().toLowerCase();const box=$('search-results');
  box.replaceChildren();
  if(!query){box.hidden=true;return;}
  const matches=BODIES.filter(b=>b.name.toLowerCase().includes(query)||b.kind.toLowerCase().includes(query));
  for(const b of matches){
    const button=document.createElement('button');button.className='search-result';button.dataset.searchBody=b.id;
    const title=document.createElement('strong');title.textContent=b.name;
    const kind=document.createElement('span');kind.textContent=b.kind;
    button.append(title,kind);button.onclick=()=>{select(b.id,true);box.hidden=true;$('search').value='';$('search').blur();};box.append(button);
  }
  if(!matches.length){const p=document.createElement('p');p.className='no-results';p.textContent='No worlds found. Try Mars, Europa, or Ceres.';box.append(p);}
  box.hidden=false;
}
function attachUI(){
  for(const b of document.querySelectorAll('[data-window]'))b.onclick=()=>window.cosmos.window(b.dataset.window);
  for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>setFilter(b.dataset.filter);
  $('overview').onclick=()=>{select('sun');flight.overview();if(!settings.orbitLines){settings.orbitLines=true;applySettings();}toast('Solar system overview · scroll to explore the outer planets');};
  $('warp').onclick=()=>flight.visit(selected);
  $('orbit').onclick=()=>flight.visit(selected);
  $('land').onclick=land;
  $('surface-exit').onclick=()=>flight.visit(universe.landing.body?.id||selected);
  $('telescope-zoom').onclick=()=>{flight.camera.zoom=1;flight.camera.updateProjectionMatrix();};
  $('orbit-mode').onclick=()=>flight.visit(selected);
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
  for(const id of ['settings','help']){
    $(id+'-button').onclick=()=>{flight.keys.clear();flight.velocity.set(0,0,0);$(id+'-dialog').showModal();};
    $(id+'-dialog').querySelector('.dialog-close').onclick=()=>$(id+'-dialog').close();
    $(id+'-dialog').addEventListener('click',e=>{if(e.target===$(id+'-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  }
  for(const id of ['quality','bloom','exposure','stars','shadows']){
    $(id)[id==='shadows'?'checked':'value']=settings[id];
    $(id).oninput=e=>{settings[id]=id==='shadows'?e.target.checked:id==='quality'?e.target.value:Number(e.target.value);applySettings();};
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
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
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
  for(const b of BODIES){
    const el=document.createElement('button');el.className='object-label';el.textContent=b.name;el.setAttribute('aria-label',`Select ${b.name}`);el.onclick=()=>select(b.id,true);
    $('labels').append(el);labelNodes.set(b.id,el);
  }
}
function updateLabels(){
  const placed=[];
  for(const b of BODIES){
    const el=labelNodes.get(b.id);const p=settings.labels&&hud&&selected!==b.id?universe.project(b.id):null;
    // Reserve the panels and avoid a stack of unreadable labels at interstellar distances.
    const bodyPoint=universe.nodes.get(b.id).group.position;
    const selectedNode=universe.nodes.get(selected);
    const targetPoint=selectedNode.group.position;
    const direction=bodyPoint.clone().normalize(),along=targetPoint.dot(direction);
    const occluded=along>0 && along<bodyPoint.length() && targetPoint.clone().addScaledVector(direction,-along).length()<selectedNode.radius;
    const visible=p&&!occluded&&p.y>260&&p.y<innerHeight-235&&p.x>285&&p.x<innerWidth-295&&!placed.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<34);
    el.hidden=!visible;if(visible){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;placed.push(p);}
  }
}
function frame(now){
  const actualDt=Math.max(0,(now-lastFrame)/1000),dt=Math.min(.1,actualDt);lastFrame=now;elapsed+=dt;
  if(!document.hidden){
    const boundary=clock.atBoundary;clock.step(actualDt);
    if(clock.atBoundary&&!boundary)toast('Time paused at the limit of the 1800–2050 orbital model.');
    universe.updatePositions(clock.jd);flight.update(dt);universe.updateScene(clock.jd,elapsed,flight.position,flight);universe.render();
    fpsFrames++;fpsTime+=actualDt;
    if(now-lastUI>120){
      timeUI();updateTargetDistance();updateLabels();
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
  if(bodies.length!==BODIES.length)throw new Error('The local celestial catalog is incomplete.');
  $('load-message').textContent='Loading planetary maps…';
  const textures=await loadTextures(BODIES,progress=>{$('load-progress').style.width=`${progress*85}%`;});
  $('load-message').textContent='Starting the WebGL 2 observatory…';
  universe=new Universe($('universe'),BODIES,textures,settings);
  universe.updatePositions(clock.jd);
  flight=new Flight(universe,$('universe'),modeChanged,id=>select(id,true));
  document.querySelector('.count').textContent=`${BODIES.length} OBJECTS`;
  flight.visit('earth',true);universe.updateScene(clock.jd,0,flight.position);
  attachUI();createLabels();select('earth');applySettings();timeUI();
  // Compile before removing the loading screen to expose shader failures early.
  universe.render();
  if(universe.shaderError)throw new Error('A graphics shader could not compile on this GPU.');
  $('load-progress').style.width='100%';$('loading').hidden=true;
  window.__cosmos={
    ready:true,
    diagnostics:()=>({...universe.getDiagnostics(),selected,mode:flight.mode,jd:clock.jd,rate:clock.rate,paused:clock.paused,
      position:flight.position.toArray(),zoom:flight.camera.zoom,effectiveFOV:flight.camera.getEffectiveFOV(),speed:flight.speed,settings:{...settings},warp:!!flight.warp,fps:measuredFPS}),
  };
  if((await window.cosmos.version()).testing){
    window.__cosmos.place=async(id,latitude,longitude,altitude=1000,lookDown=false)=>{
      const {surfaceDirection}=await import('./data/geography.js');
      const {Vector3,Quaternion,Euler}=await import('three');
      select(id);flight.target=id;flight.free();
      const landing=universe.landing,body=BY_ID[id],local=new Vector3(...surfaceDirection(latitude,longitude)),q=landing.bodyRotation(id);
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
