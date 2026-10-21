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
  await page.locator('#land').click();await settle();assert.equal((await state()).mode,'land');
  await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible,{},{timeout:20000});
  await page.screenshot({path:'test-output/surface.png'});
  assert.equal((await state()).landing.type,'grass');
  await page.locator('#universe').click({position:{x:700,y:450}});
  assert.equal((await state()).mode,'land');
  const surfaceBefore=(await state()).position;
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  assert.equal((await state()).mode,'land');assert.ok(Math.hypot(...(await state()).position.map((v,i)=>v-surfaceBefore[i]))>1e-7);
  await page.mouse.move(730,500);await page.mouse.down();await page.mouse.move(790,490,{steps:5});await page.mouse.up();
  assert.equal((await state()).landing.visible,true);
  for(const biome of ['sand','water','grass']){
    await page.locator(`[data-biome="${biome}"]`).click();
    await page.waitForFunction(type=>window.__cosmos.diagnostics().landing.visible&&window.__cosmos.diagnostics().landing.type===type,biome,{timeout:20000});
    await page.waitForTimeout(200);await page.screenshot({path:`test-output/earth-${biome}.png`});
  }
  checks.push('Land-only grass, beach, animated ocean, walking, and mouse look');
  await page.locator('#orbit').click();await settle();
  assert.equal((await state()).landing.visible,false);
  checks.push('Surface approach and return to orbit');
  for(const name of ['Mercury','Venus','Mars','Moon','Io','Europa','Titan','Enceladus','Pluto','Charon','Ceres','Eris','Jupiter']){
    await page.locator('#search').fill(name);await page.locator('#search').press('Enter');await settle();
    assert.equal((await state()).landing.visible,false);
    await page.locator('#land').click();await settle();
    await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible,{},{timeout:20000});
    assert.equal((await state()).shaderError,null);assert.equal((await state()).landing.error,null);
    await page.waitForTimeout(100);
    if(['Moon','Europa','Titan','Pluto','Jupiter'].includes(name))await page.screenshot({path:`test-output/land-${name.toLowerCase()}.png`});
    console.log(`Landing verified: ${name}`);
  }
  checks.push('Rocky planets, major moon systems, dwarf planets, and cloud-top landing scenes');
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
