import {GALAXIES} from '../src/data/galaxies.js';
import {headlessLaunch} from './headless-launch.mjs';
import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {defaults} from '../electron/settings.js';
const profile=path.join(process.cwd(),'.polish-profile');await mkdir(profile,{recursive:true});await mkdir('test-output',{recursive:true});await writeFile(path.join(profile,'settings.json'),JSON.stringify(defaults));await writeFile(path.join(profile,'worlds.json'),JSON.stringify({version:1,planets:[]}));
const packaged=process.env.COSMOS_PACKAGED_PATH,errors=[],checks=[];const app=process.env.COSMOS_HEADLESS?await headlessLaunch():await electron.launch({...(packaged?{executablePath:packaged,args:[]}:{args:['.']}),env:{...process.env,COSMOS_TEST_PROFILE:profile}});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});if(!process.env.COSMOS_HEADLESS)await page.context().route(/^https?:\/\//,r=>r.abort());
try{
 await page.waitForFunction(()=>window.__cosmos?.ready||document.querySelector('#load-message')?.textContent.startsWith('Unable'),{},{timeout:90000});if(!await page.evaluate(()=>window.__cosmos?.ready))throw new Error(await page.locator('#load-message').textContent());await page.locator('#pause').click();assert.ok((await page.locator('#body-list').boundingBox()).height>=60,'catalog remains usable on compact displays');
 for(const id of ['moon','deimos','mars','earth']){
  await page.evaluate(id=>window.__cosmos.placeSunlit(id,100),id);await page.waitForFunction(id=>{const d=window.__cosmos.diagnostics();return d.landing.body===id&&d.landing.visible;},id,{timeout:30000});await page.waitForTimeout(800);await page.screenshot({path:`test-output/polish-${id}.png`});
  const d=await page.evaluate(()=>window.__cosmos.diagnostics());assert.equal(d.shaderError,null);assert.equal(d.streamError,null);assert.equal(d.landing.error,null);
 }
 checks.push('Sunlit Earth, Mars, Moon and Deimos terrain renders without shader or streaming errors');
 await page.evaluate(()=>window.__cosmos.visitBody('sagittarius-a'));await page.waitForTimeout(1000);await page.screenshot({path:'test-output/polish-black-hole.png'});assert.equal(await page.evaluate(()=>window.__cosmos.tryLanding('sagittarius-a')),false);checks.push('Sagittarius A* renders and rejects landing');
 for(const galaxy of GALAXIES.map(g=>g.id)){
  await page.evaluate(id=>window.__cosmos.exploreGalaxy(id),galaxy);await page.waitForFunction(id=>{const g=window.__cosmos.diagnostics().galaxy;return g.galaxy===id&&!g.pending&&g.sectorStars>0;},galaxy,{timeout:30000});
  const d=await page.evaluate(()=>window.__cosmos.diagnostics());assert.equal(d.galaxy.radiusLY,10);assert.ok(d.galaxy.sectorStars<1000);assert.equal(d.shaderError,null);assert.equal(d.streamError,null);
 }
 checks.push('All nine galaxies populate bounded local stars automatically');
 await page.evaluate(()=>window.__cosmos.exploreGalaxy('andromeda',false));await page.waitForTimeout(800);await page.screenshot({path:'test-output/polish-andromeda-overview.png'});
 await page.evaluate(()=>window.__cosmos.exploreGalaxy('andromeda'));await page.waitForFunction(()=>window.__cosmos.diagnostics().galaxy.sectorStars>0&&!window.__cosmos.diagnostics().galaxy.pending);
 for(const [quality,radius] of [['low',10],['high',10],['medium',10]]){
  await page.locator('#settings-button').click();await page.locator('#quality').selectOption(quality);await page.locator('#settings-dialog .dialog-close').click();await page.waitForFunction(r=>{const d=window.__cosmos.diagnostics().galaxy;return d.radiusLY===r&&!d.pending;},radius);assert.ok((await page.evaluate(()=>window.__cosmos.diagnostics().galaxy.sectorStars))<6000);
 }
 checks.push('All graphics qualities retain a 10 ly local generation radius');
 // Inspect the M31 sky in six directions with no foreground planet.
 for(const [yaw,pitch] of [[0,0],[Math.PI/2,0],[Math.PI,0],[-Math.PI/2,0],[0,Math.PI/2],[0,-Math.PI/2]]){
  const sky=await page.evaluate(([yaw,pitch])=>window.__cosmos.skyProbe(yaw,pitch),[yaw,pitch]);assert.ok(sky.whiteFraction<.08&&sky.longestWhiteRow<.3,JSON.stringify(sky));
 }
 await page.screenshot({path:'test-output/local-m31-sky.png'});checks.push('M31 sky has no large white walls across six viewing directions');
 const mapBefore=await page.evaluate(()=>window.__cosmos.diagnostics());await page.locator('#neighborhood-view').click();
 await page.waitForFunction(()=>window.__cosmos.diagnostics().starMap.open);await page.screenshot({path:'test-output/local-m31-map.png'});
 const mapped=await page.evaluate(()=>window.__cosmos.diagnostics());assert.deepEqual(mapped.position,mapBefore.position);assert.equal(mapped.referenceSystem,mapBefore.referenceSystem);assert.ok(mapped.starMap.stars.length>0);assert.ok(Math.hypot(...mapped.starMap.centerLY.map((v,i)=>v-mapped.galaxy.centerLY[i]))<1e-6);
 await page.locator('#star-map-dialog .dialog-close').click();checks.push('Star map centers on the player in M31 without moving the flight camera');
 // Bubble follows ordinary thrust; then test a location outside every catalog galaxy.
 await page.evaluate(()=>window.__cosmos.placeSpace([1e8,1e8,1e8]));await page.waitForFunction(()=>{const g=window.__cosmos.diagnostics().galaxy;return !g.pending&&g.localStars>0&&g.galaxy===null;});
 const previous=await page.evaluate(()=>window.__cosmos.sectorProbe());
 await page.locator('#speed-slider').fill('15.97');await page.locator('#speed-slider').evaluate(el=>el.blur());await page.keyboard.down('w');await page.waitForTimeout(4000);await page.keyboard.up('w');await page.waitForTimeout(2000);await page.waitForFunction(()=>!window.__cosmos.diagnostics().galaxy.pending);
 const moved=await page.evaluate(()=>({g:window.__cosmos.diagnostics().galaxy,stars:window.__cosmos.sectorProbe()}));assert.ok(moved.stars.some(b=>!previous.some(a=>a.id===b.id)));assert.ok(moved.stars.every(b=>Math.hypot(...b.anchor.map((v,i)=>v/9.4607304725808e12-moved.g.centerLY[i]))<=10.00001));
 await page.locator('#neighborhood-view').click();await page.screenshot({path:'test-output/local-deep-space-map.png'});await page.locator('#star-map-go').click();await page.waitForFunction(()=>!window.__cosmos.diagnostics().warp);assert.ok((await page.evaluate(()=>window.__cosmos.diagnostics().visibleCatalog)).length>=5);
 checks.push('WASD flight streams new stars in deep space; local-map Go to opens a populated system');
 const stars=await page.evaluate(()=>window.__cosmos.sectorProbe());const before=await page.evaluate(()=>window.__cosmos.diagnostics().position);
 await page.evaluate(id=>window.__cosmos.selectBody(id),stars[0].id);assert.deepEqual(await page.evaluate(()=>window.__cosmos.diagnostics().position),before);
 await page.evaluate(id=>window.__cosmos.visitBody(id),stars[0].id);await page.waitForFunction(id=>window.__cosmos.diagnostics().referenceSystem===id,stars[0].id);
 const members=await page.evaluate(()=>window.__cosmos.diagnostics().visibleCatalog);assert.ok(members.length>=5);const planet=members.find(id=>id.startsWith('generated-'));await page.evaluate(id=>window.__cosmos.visitBody(id),planet);await page.waitForTimeout(2000);await page.screenshot({path:'test-output/polish-galaxy-planet.png'});
 checks.push('Selecting a procedural star stays in place; Go to reveals its planets and moons');
 for(let i=0;i<7;i++){await page.waitForFunction(()=>!window.__cosmos.diagnostics().galaxy.pending);const nearby=await page.evaluate(()=>window.__cosmos.sectorProbe());await page.evaluate(id=>window.__cosmos.visitBody(id),nearby[Math.min(i+1,nearby.length-1)].id);await page.waitForTimeout(250);}
 const final=await page.evaluate(()=>window.__cosmos.diagnostics());assert.ok(final.bodies<900,JSON.stringify({bodies:final.bodies}));assert.equal(final.streamError,null);assert.equal(final.shaderError,null);assert.deepEqual(errors,[]);
 checks.push('Repeated system visits release old system objects and keep residency bounded');
 await writeFile('test-output/polish-report.json',JSON.stringify({packaged:!!packaged,checks,errors,diagnostics:final},null,2));console.log(JSON.stringify({checks,errors}));
}catch(e){console.error(JSON.stringify({errors,checks}));await page.screenshot({path:'test-output/polish-failure.png'}).catch(()=>{});throw e;}finally{await app.close();}
