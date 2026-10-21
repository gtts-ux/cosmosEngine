import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaults } from '../electron/settings.js';
import { createIcon } from './icon.mjs';
import { BODIES } from '../src/data/catalog.js';
const root=process.cwd();
await mkdir('test-output',{recursive:true});
await mkdir('.test-profile',{recursive:true});
await writeFile('.test-profile/settings.json',JSON.stringify(defaults));
const errors=[],checks=[];
const packaged=process.env.COSMOS_PACKAGED_PATH;
const app=await electron.launch({
  ...(packaged?{executablePath:packaged,args:[]}:{args:['.']}),cwd:root,
  env:{...process.env,COSMOS_TEST_PROFILE:path.join(root,'.test-profile')},
});
try {
  const page=await app.firstWindow();
  await page.context().route(/^https?:\/\//,route=>route.abort());
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.waitForFunction(()=>window.__cosmos?.ready,{},{timeout:60000});
  await createIcon(page);
  const state=()=>page.evaluate(()=>window.__cosmos.diagnostics());
  const settle=()=>page.waitForFunction(()=>!window.__cosmos.diagnostics().warp,{},{timeout:20000});
  let d=await state();assert.ok(d.webgl.includes('WebGL 2'));assert.equal(d.bodies,BODIES.length);assert.equal(d.shaderError,null);assert.equal(d.logarithmicDepthBuffer,true);
  checks.push(`WebGL2 rendering, ${BODIES.length} bodies, logarithmic depth, no shader errors`);
  await page.locator('#pause').click();
  const startJD=(await state()).jd;
  await page.waitForTimeout(300);assert.equal((await state()).jd,startJD);
  await page.screenshot({path:'test-output/earth.png'});
  checks.push('Pause holds simulated time');
  await page.locator('#reverse').click();await page.locator('[data-rate="1000000"]').click();
  await page.waitForTimeout(300);assert.ok((await state()).jd<startJD);
  await page.locator('#realtime').click();assert.equal((await state()).rate,1);
  checks.push('Reverse, maximum time warp, and realtime reset');
  await page.locator('#search').fill('Europa');await page.locator('#search').press('Enter');await settle();
  assert.equal((await state()).selected,'europa');assert.equal((await state()).mode,'orbit');
  checks.push('Search-to-warp and satellite orbit tracking');
  await page.locator('#search').fill('Saturn');await page.locator('#search').press('Enter');await settle();
  await page.screenshot({path:'test-output/saturn.png'});
  assert.equal((await state()).selected,'saturn');
  await page.locator('#scale-toggle').click();assert.equal((await state()).settings.balanced,true);
  await page.locator('#scale-toggle').click();assert.equal((await state()).settings.balanced,false);
  checks.push('True scale / balanced scale transitions');
  await page.locator('#search').fill('Earth');await page.locator('#search').press('Enter');await settle();
  await page.locator('#free-mode').click();
  const before=(await state()).position;
  await page.locator('#universe').click({position:{x:650,y:600}});
  await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
  const after=(await state()).position;
  assert.ok(Math.hypot(...after.map((v,i)=>v-before[i]))>.001);assert.equal((await state()).mode,'free');
  checks.push('Free flight input moves the floating-origin camera');
  // Fixtures put a free-flight camera above real globe coordinates; no Land action.
  for(const [name,lat,lon,type] of [['Earth',0,-140,'water'],['Earth',23,13,'sand'],['Earth',48,20,'grass'],['Earth',80,-40,'ice'],['Moon',0,0,'rock'],['Mars',0,0,'rock'],['Europa',0,0,'ice'],['Pluto',0,0,'ice']]){
    await page.evaluate(async({id,lat,lon})=>window.__cosmos.place(id,lat,lon,100),{id:name.toLowerCase(),lat,lon});
    await page.waitForFunction(({id,type})=>{const d=window.__cosmos.diagnostics();return d.landing.visible&&d.landing.body===id&&d.landing.type===type;},{id:name.toLowerCase(),type},{timeout:20000});
    d=await state();assert.equal(d.mode,'free');assert.equal(d.shaderError,null);assert.equal(d.landing.error,null);
    assert.ok(Math.abs(d.landing.latitude-lat)<.01);assert.ok(Math.abs(d.landing.longitude-lon)<.01);
    await page.screenshot({path:`test-output/auto-${name.toLowerCase()}-${type}.png`});
    console.log(`Automatic mapped surface verified: ${name} ${type} at ${lat}, ${lon}`);
  }
  checks.push('Automatic free-flight surfaces: mapped Earth ocean, Sahara sand, vegetation, ice; Moon, Mars, Europa and Pluto');
  // Start above the visibility threshold and descend using thrust alone.
  await page.evaluate(()=>window.__cosmos.place('earth',0,-140,12000,true));
  await page.waitForTimeout(200);assert.equal((await state()).landing.visible,false);
  await page.locator('#speed-slider').fill('3.5');await page.locator('#speed-slider').evaluate(el=>el.blur());
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible,{},{timeout:15000});
  await page.keyboard.up('w');
  assert.equal((await state()).mode,'free');
  checks.push('Continuous WASD descent activates terrain without pressing Land');
  // Streaming recenters while flying several kilometres across the same world.
  await page.evaluate(()=>window.__cosmos.place('earth',23,13,100));
  await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible&&window.__cosmos.diagnostics().landing.type==='sand');
  await page.locator('#speed-slider').fill('3.5');await page.locator('#speed-slider').evaluate(el=>el.blur());
  await page.keyboard.down('d');await page.waitForTimeout(3500);await page.keyboard.up('d');
  await page.waitForTimeout(1000);d=await state();assert.equal(d.mode,'free');assert.equal(d.landing.visible,true);assert.equal(d.landing.body,'earth');assert.ok(Math.abs(d.landing.longitude-13)>.02);
  checks.push('Surface detail streams while free-flying across kilometres of mapped terrain');
  const zoomBefore=await state();
  await page.mouse.move(700,500);await page.keyboard.down('Shift');await page.mouse.wheel(0,-10000);await page.keyboard.up('Shift');
  await page.waitForFunction(()=>window.__cosmos.diagnostics().zoom===1000);
  assert.equal((await state()).speed,zoomBefore.speed);
  await page.keyboard.down('Shift');await page.mouse.wheel(0,10000);await page.keyboard.up('Shift');
  await page.waitForFunction(()=>window.__cosmos.diagnostics().zoom===.5);
  await page.locator('#telescope-zoom').click();assert.equal((await state()).zoom,1);
  checks.push('Shift-scroll telescope clamps at 0.5× and 1000×, preserves throttle, and resets to 1×');
  await page.evaluate(()=>window.__cosmos.place('moon',0,0,5));
  await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.body==='moon'&&window.__cosmos.diagnostics().landing.visible);
  const moonBefore=await state();await page.locator('[data-rate="1000"]').click();await page.waitForTimeout(1000);const moonAfter=await state();
  await page.locator('#realtime').click();
  assert.ok(Math.max(...moonBefore.landing.color)-Math.min(...moonBefore.landing.color)<.001);
  assert.ok(Math.abs(moonAfter.landing.latitude-moonBefore.landing.latitude)<.001);assert.ok(Math.abs(moonAfter.landing.longitude-moonBefore.landing.longitude)<.001);
  await page.locator('#land').click();await settle();assert.equal((await state()).mode,'land');
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  assert.equal((await state()).landing.visible,true);
  await page.keyboard.press('f');assert.equal((await state()).mode,'free');assert.equal((await state()).landing.visible,true);
  checks.push('Body-fixed free flight follows orbital motion and spin; optional Land and walking remain available');
  await page.locator('#orbit').click();await settle();assert.equal((await state()).landing.visible,false);
  for(const name of ['Mercury','Venus','Io','Titan','Enceladus','Charon','Ceres','Eris','Jupiter']){
    await page.locator('#search').fill(name);await page.locator('#search').press('Enter');await settle();
    await page.locator('#land').click();await settle();
    await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible,{},{timeout:20000});
    assert.equal((await state()).shaderError,null);assert.equal((await state()).landing.error,null);
    if(['Titan','Jupiter'].includes(name))await page.screenshot({path:`test-output/land-${name.toLowerCase()}.png`});
    console.log(`Landing verified: ${name}`);
  }
  checks.push('Mapped rocky planets, moon systems, dwarf planets and gas giant cloud decks');
  for(const body of BODIES.filter(b=>b.id!=='sun')){
    await page.evaluate(id=>window.__cosmos.place(id,0,0,30),body.id);
    await page.waitForFunction(id=>{const d=window.__cosmos.diagnostics();return d.landing.visible&&d.landing.body===id;},body.id,{timeout:20000});
    assert.equal((await state()).shaderError,null);assert.equal((await state()).landing.error,null);
  }
  checks.push('Automatic terrain rendered on all 37 landable catalog bodies, including every included moon and dwarf planet');

  await page.locator('#search').fill('Earth');await page.locator('#search').press('Enter');await settle();
  await page.locator('#settings-button').click();
  await page.locator('#quality').selectOption('medium');
  await page.locator('#shadows').uncheck();
  await page.locator('#orbit-lines').check();
  await page.locator('#settings-dialog .dialog-close').click();
  assert.equal((await state()).settings.shadows,false);
  assert.equal((await state()).settings.orbitLines,true);
  await page.waitForTimeout(300);
  const saved=await page.evaluate(()=>window.cosmos.settings.load());assert.equal(saved.quality,'medium');assert.equal(saved.shadows,false);
  const rejected=await page.evaluate(async()=>{
    try{await window.cosmos.texture('../../electron/main.js');return false;}catch{return true;}
  });assert.ok(rejected);
  const protocolDenied=await page.evaluate(async()=>{try{const r=await fetch('cosmos://evil/index.html');return r.status===403;}catch{return true;}});
  assert.ok(protocolDenied);
  const processType=await page.evaluate(()=>typeof window.require);assert.equal(processType,'undefined');
  checks.push('Graphics settings, persisted preferences, IPC allowlist, renderer isolation');
  await page.locator('#overview').click();await settle();
  await page.screenshot({path:'test-output/overview.png'});
  checks.push('System overview with orbit paths');
  await page.locator('#warp').click();await settle();
  await page.screenshot({path:'test-output/sun.png'});
  assert.equal((await state()).shaderError,null);
  checks.push('Animated solar shader and corona close-up');
  await page.keyboard.press('h');assert.equal(await page.locator('.topbar').isVisible(),false);
  await page.locator('#show-hud').click();assert.equal(await page.locator('.topbar').isVisible(),true);
  await page.locator('#help-button').click();assert.equal(await page.locator('#help-dialog').isVisible(),true);
  await page.keyboard.press('Escape');
  checks.push('HUD hiding and keyboard-accessible flight manual');
  // Return to the intended first-run appearance.
  await page.locator('#settings-button').click();await page.locator('#quality').selectOption('medium');await page.locator('#shadows').check();await page.locator('#orbit-lines').uncheck();await page.locator('#settings-dialog .dialog-close').click();
  await page.locator('#search').fill('Earth');await page.locator('#search').press('Enter');await settle();
  await page.waitForTimeout(3000);
  d=await state();
  assert.equal(d.shaderError,null);
  // Invalid protocol access is an intentional negative security test.
  const unexpected=errors.filter(e=>!e.includes('403')&&!e.includes('cosmos://evil'));
  assert.deepEqual(unexpected,[]);
  const gpu=await app.evaluate(({app})=>app.getGPUFeatureStatus());
  await writeFile('test-output/report.json',JSON.stringify({packaged:!!packaged,checks,diagnostics:d,gpu,errors:unexpected},null,2));
  console.log(JSON.stringify({packaged:!!packaged,passed:checks.length,checks,diagnostics:d,gpu},null,2));
} catch(error) {
  const page=await app.firstWindow();
  await page.screenshot({path:'test-output/failure.png'}).catch(()=>{});
  console.error('Renderer errors:',errors);
  throw error;
} finally { await app.close(); }
