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
 for(const galaxy of ['milky-way','andromeda','triangulum','lmc','smc']){
  await page.evaluate(id=>window.__cosmos.exploreGalaxy(id),galaxy);await page.waitForFunction(id=>{const g=window.__cosmos.diagnostics().galaxy;return g.galaxy===id&&!g.pending&&g.sectorStars>0;},galaxy,{timeout:30000});
  const d=await page.evaluate(()=>window.__cosmos.diagnostics());assert.equal(d.galaxy.radiusLY,20);assert.ok(d.galaxy.sectorStars<1000);assert.equal(d.shaderError,null);assert.equal(d.streamError,null);
 }
 checks.push('All five galaxies populate bounded local stars automatically');
 await page.evaluate(()=>window.__cosmos.exploreGalaxy('andromeda',false));await page.waitForTimeout(800);await page.screenshot({path:'test-output/polish-andromeda-overview.png'});
 await page.evaluate(()=>window.__cosmos.exploreGalaxy('andromeda'));await page.waitForFunction(()=>window.__cosmos.diagnostics().galaxy.sectorStars>0&&!window.__cosmos.diagnostics().galaxy.pending);
 for(const [quality,radius] of [['low',10],['high',50],['medium',20]]){
  await page.locator('#settings-button').click();await page.locator('#quality').selectOption(quality);await page.locator('#settings-dialog .dialog-close').click();await page.waitForFunction(r=>{const d=window.__cosmos.diagnostics().galaxy;return d.radiusLY===r&&!d.pending;},radius);assert.ok((await page.evaluate(()=>window.__cosmos.diagnostics().galaxy.sectorStars))<6000);
 }
 checks.push('Quality changes enforce the requested 10, 20 and 50 ly generation radii');
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
