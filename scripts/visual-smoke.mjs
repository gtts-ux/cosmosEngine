import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {defaults} from '../electron/settings.js';
const profile=path.join(process.cwd(),'.visual-test-profile');await mkdir(profile,{recursive:true});await mkdir('test-output',{recursive:true});
await writeFile(path.join(profile,'settings.json'),JSON.stringify(defaults));
await writeFile(path.join(profile,'worlds.json'),JSON.stringify({version:1,planets:[]}));
const packaged=process.env.COSMOS_PACKAGED_PATH,errors=[],checks=[];
const app=await electron.launch({...(packaged?{executablePath:packaged,args:[]}:{args:['.']}),env:{...process.env,COSMOS_TEST_PROFILE:profile}});
const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.context().route(/^https?:\/\//,route=>route.abort());
try{
 await page.waitForFunction(()=>window.__cosmos?.ready,{},{timeout:90000});
 await page.locator('#pause').click();await page.locator('#neighborhood-view').click();
 await page.waitForFunction(()=>!window.__cosmos.diagnostics().warp);
 const stars=await page.evaluate(()=>window.__cosmos.starProbe());
 assert.ok(stars.filter(s=>s.id!=='sun'&&s.brightness>40).length>=25,JSON.stringify(stars));
 await page.screenshot({path:'test-output/visible-nearby-stars.png'});checks.push('At least 25 nearby stars produce measurable bright pixels in the star map');
 for(const id of ['jupiter','saturn']){
  await page.evaluate(id=>window.__cosmos.gasFlight(id,5),id);
  await page.waitForFunction(id=>window.__cosmos.bodyProbe(id).textureWidth===4096,id,{timeout:20000});
  await page.screenshot({path:`test-output/photo-clouds-${id}.png`});
 }
 checks.push('Jupiter and Saturn stream their 4096-pixel photo-derived cloud maps near the camera');
 for(const id of ['jupiter','saturn','uranus','neptune']){
  await page.evaluate(id=>window.__cosmos.gasFlight(id),id);
  await page.keyboard.down('w');
  await page.waitForFunction(id=>window.__cosmos.bodyProbe(id).fraction<.99,id,{timeout:15000});
  await page.keyboard.up('w');
  const d=await page.evaluate(id=>({body:window.__cosmos.bodyProbe(id),air:window.__cosmos.diagnostics().atmosphere,land:window.__cosmos.tryLanding(id)}),id);
  assert.equal(d.body.mode,'free');assert.equal(d.body.mesh,false);assert.equal(d.air.body,id);assert.ok(d.air.transmission<.001);assert.equal(d.land,false);
  await page.screenshot({path:`test-output/inside-${id}.png`});
  // Place just inside the opposite cloud boundary, then exit using thrust.
  await page.evaluate(id=>window.__cosmos.gasFlight(id,-.99),id);
  await page.keyboard.down('w');await page.waitForFunction(id=>window.__cosmos.bodyProbe(id).fraction>1.02,id,{timeout:15000});await page.keyboard.up('w');
  assert.equal((await page.evaluate(id=>window.__cosmos.bodyProbe(id),id)).mesh,true);
 }
 checks.push('Free-flight thrust enters and exits all four giants; interiors obscure space and landing remains rejected');
 await page.evaluate(()=>window.__cosmos.placeSunlit('moon',100));
 await page.waitForFunction(()=>window.__cosmos.diagnostics().landing.visible,{},{timeout:20000});
 await page.waitForTimeout(1000);
 const mountainPixels=await page.evaluate(()=>window.__cosmos.frameProbe());
 assert.ok(mountainPixels.some(p=>Math.max(...p.slice(0,3))>25),JSON.stringify(mountainPixels));
 await page.waitForFunction(()=>window.__cosmos.bodyProbe('moon').resolution===256,{},{timeout:20000});
 const moon=await page.evaluate(()=>window.__cosmos.bodyProbe('moon'));
 assert.ok(moon.rangeMeters>500,JSON.stringify(moon));assert.equal(moon.resolution,256);assert.ok(moon.groundVertices>=16641);
 await page.screenshot({path:'test-output/lunar-mountains.png'});checks.push('Lunar elevation mesh has mountains over 500 m and a detailed ground patch');
 await page.locator('#generate-planet').click();await page.locator('#generated-type').selectOption('ocean');await page.locator('#generated-name').fill('Visual Ocean');await page.locator('#generated-seed').fill('visual-v15');await page.locator('#generate-submit').click();
 await page.waitForFunction(()=>window.__cosmos.diagnostics().generated.some(b=>b.name==='Visual Ocean'),{},{timeout:30000});
 const ocean=await page.evaluate(()=>window.__cosmos.diagnostics().generated.find(b=>b.name==='Visual Ocean'));
 await page.locator('#warp').click();await page.waitForFunction(()=>!window.__cosmos.diagnostics().warp,{},{timeout:30000});
 await page.screenshot({path:'test-output/detailed-generated-ocean.png'});
 await page.evaluate(id=>window.__cosmos.placeSunlit(id,100),ocean.id);await page.waitForFunction(id=>window.__cosmos.diagnostics().landing.body===id&&window.__cosmos.diagnostics().landing.visible,ocean.id,{timeout:20000});
 await page.screenshot({path:'test-output/generated-coast-ground.png'});checks.push('Generated ocean globe and ground render with upgraded local textures');
 await page.locator('#generate-planet').click();await page.locator('#generated-type').selectOption('gas');await page.locator('#generated-name').fill('Visual Giant');await page.locator('#generated-seed').fill('visual-gas-v15');await page.locator('#generate-submit').click();
 await page.waitForFunction(()=>window.__cosmos.diagnostics().generated.some(b=>b.name==='Visual Giant'),{},{timeout:30000});
 const giant=await page.evaluate(()=>window.__cosmos.diagnostics().generated.find(b=>b.name==='Visual Giant'));
 await page.evaluate(id=>window.__cosmos.gasFlight(id),giant.id);await page.keyboard.down('w');await page.waitForFunction(id=>window.__cosmos.bodyProbe(id).fraction<.99,giant.id,{timeout:15000});await page.keyboard.up('w');
 assert.equal(await page.evaluate(id=>window.__cosmos.tryLanding(id),giant.id),false);assert.equal((await page.evaluate(id=>window.__cosmos.bodyProbe(id),giant.id)).mesh,false);
 checks.push('Generated gas giants also permit atmospheric entry and reject landing');
 assert.equal((await page.evaluate(()=>window.__cosmos.diagnostics())).shaderError,null);assert.deepEqual(errors,[]);
 await writeFile('test-output/visual-report.json',JSON.stringify({packaged:!!packaged,checks,stars,moon,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}catch(e){await page.screenshot({path:'test-output/visual-failure.png'}).catch(()=>{});console.error(errors);throw e;}finally{await app.close();}
