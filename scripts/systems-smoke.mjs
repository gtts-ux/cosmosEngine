import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {defaults} from '../electron/settings.js';
import {BODIES} from '../src/data/catalog.js';
const root=process.cwd(),profile=path.join(root,'.systems-test-profile'),checks=[],errors=[];
await mkdir(profile,{recursive:true});await mkdir('test-output',{recursive:true});
await writeFile(path.join(profile,'settings.json'),JSON.stringify(defaults));
await writeFile(path.join(profile,'worlds.json'),JSON.stringify({version:1,planets:[]}));
const packaged=process.env.COSMOS_PACKAGED_PATH;
async function launch(){
 const app=await electron.launch({...(packaged?{executablePath:packaged,args:[]}:{args:['.']}),cwd:root,env:{...process.env,COSMOS_TEST_PROFILE:profile}});
 const page=await app.firstWindow();await page.context().route(/^https?:\/\//,route=>route.abort());
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.waitForFunction(()=>window.__cosmos?.ready,{},{timeout:90000});return {app,page};
}
let {app,page}=await launch();
const state=()=>page.evaluate(()=>window.__cosmos.diagnostics());
const settle=()=>page.waitForFunction(()=>!window.__cosmos.diagnostics().warp,{},{timeout:20000});
async function create(type,name,seed){
 await page.locator('#generate-planet').click();await page.locator('#generated-type').selectOption(type);await page.locator('#generated-name').fill(name);await page.locator('#generated-seed').fill(seed);await page.locator('#generate-submit').click();
 await page.waitForFunction(name=>window.__cosmos.diagnostics().generated.some(b=>b.name===name),name,{timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('#generate-dialog').open);
 return (await state()).generated.find(b=>b.name===name);
}
try{
 let d=await state();assert.equal(d.bodies,BODIES.length);assert.equal(d.nearbyStars,56);assert.equal(d.currentSystem,'sun');assert.ok(d.visibleCatalog.includes('earth'));assert.ok(!d.visibleCatalog.includes('proxima-centauri'));
 await page.locator('#pause').click();const before=(await state()).position;
 await page.locator('[data-filter="stars"]').click();assert.equal((await state()).visibleCatalog.length,56);
 await page.locator('[data-body="proxima-centauri"]').click();d=await state();assert.equal(d.browsingSystem,'proxima-centauri');assert.equal(d.currentSystem,'sun');assert.deepEqual(d.position,before);assert.deepEqual(d.visibleCatalog,['proxima-centauri']);
 checks.push('56 star entries including Sun; selecting Proxima previews only its system without travelling');
 const ocean=await create('ocean','Test Ocean','proxima-one');d=await state();assert.equal(ocean.parent,'proxima-centauri');assert.equal(d.warp,false);assert.equal(d.currentSystem,'sun');assert.ok(d.visibleCatalog.includes(ocean.id));assert.ok(!d.visibleCatalog.includes('earth'));
 checks.push('Generator creates a named, seeded ocean planet in the inspected system and updates the catalog');
 await page.locator('#warp').click();await settle();await page.waitForFunction(()=>window.__cosmos.diagnostics().currentSystem==='proxima-centauri');
 assert.equal((await state()).referenceSystem,'proxima-centauri');
 await page.evaluate(id=>window.__cosmos.place(id,0,0,20),ocean.id);
 await page.waitForFunction(id=>{const d=window.__cosmos.diagnostics();return d.landing.visible&&d.landing.body===id;},ocean.id,{timeout:20000});
 await page.locator('#land').click();await settle();const walk=(await state()).position;
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');d=await state();
 assert.equal(d.mode,'land');assert.ok(Math.hypot(...d.position.map((v,i)=>v-walk[i]))>1e-7);assert.ok(Math.max(...d.position.map(Math.abs))<1e6);
 await page.screenshot({path:'test-output/proxima-generated-surface.png'});
 checks.push('Interstellar Go to rebases coordinates; generated ocean terrain and metre-scale walking work at Proxima');
 await page.locator('#surface-exit').click();await settle();
 const gas=await create('gas','Test Giant','proxima-two');assert.equal(await page.locator('#land').isDisabled(),true);assert.equal(await page.evaluate(id=>window.__cosmos.tryLanding(id),gas.id),false);
 checks.push('Generated gas giants retain landing restrictions');
 const inspected=(await state()).position;
 await page.locator('#system-select').selectOption('star-hyg-8087');assert.equal((await state()).browsingSystem,'star-hyg-8087');assert.deepEqual((await state()).position,inspected);
 await page.locator('#generate-system').click();
 await page.waitForFunction(()=>window.__cosmos.diagnostics().generated.length===6,{},{timeout:15000});
 d=await state();const tau=d.generated.filter(b=>b.parent==='star-hyg-8087');assert.equal(tau.length,4);assert.ok(tau.every(b=>d.visibleCatalog.includes(b.id)));assert.equal(await page.locator('#generate-system').isDisabled(),true);
 checks.push('System seeding creates four fictional planets around Tau Ceti and keeps catalogs separate');
 await page.locator('#warp').click();await settle();await page.waitForFunction(()=>window.__cosmos.diagnostics().currentSystem==='star-hyg-8087');assert.equal((await state()).referenceSystem,'star-hyg-8087');
 await page.screenshot({path:'test-output/tau-ceti-generated-system.png'});
 checks.push('Travelling to another generated system updates physical system, reference origin and sidebar');
 await page.locator('#neighborhood-view').click();await settle();await page.waitForFunction(()=>window.__cosmos.diagnostics().currentSystem===null);d=await state();assert.equal(d.visibleCatalog.length,56);assert.ok(d.visibleCatalog.includes('alpha-centauri-a'));await page.screenshot({path:'test-output/stellar-neighborhood.png'});
 checks.push('Neighborhood overview renders catalog stars and recognizes interstellar space');
 await page.evaluate(()=>window.__cosmos.place('star-hyg-8087',0,0,100000000));await page.waitForFunction(()=>window.__cosmos.diagnostics().currentSystem==='star-hyg-8087');assert.equal((await state()).mode,'free');assert.equal((await state()).browsingSystem,'star-hyg-8087');
 checks.push('Free-flight arrival updates physical system and sidebar without a Go to action');
 await page.locator('#system-select').selectOption('sun');await page.locator('#warp').click();await settle();await page.waitForFunction(()=>window.__cosmos.diagnostics().currentSystem==='sun');assert.ok((await state()).visibleCatalog.includes('earth'));
 checks.push('Returning to the Solar System restores its original catalog');
 const rejected=await page.evaluate(async()=>{
  const results=[];for(const input of [{hostId:'earth'},{hostId:'proxima-centauri',count:99},{hostId:'proxima-centauri',type:'script'},{hostId:'../../x'}]){try{await window.cosmos.worlds.generate(input);results.push(false);}catch{results.push(true);}}return results;
 });assert.ok(rejected.every(Boolean));
 const saved=await page.evaluate(()=>window.cosmos.worlds.load());assert.equal(saved.state.planets.length,6);assert.equal(saved.bodies.length,6);
 checks.push('Validated IPC rejects invalid generation requests and persists generation recipes');
 const ids=saved.bodies.map(b=>b.id).sort();await app.close();({app,page}=await launch());
 d=await state();assert.deepEqual(d.generated.map(b=>b.id).sort(),ids);assert.equal(d.bodies,BODIES.length+6);
 await page.locator('#system-select').selectOption('proxima-centauri');assert.ok((await state()).visibleCatalog.includes(ocean.id));
 await page.locator(`[data-body="${ocean.id}"]`).click();await page.locator('#warp').click();await settle();
 await page.evaluate(id=>window.__cosmos.place(id,0,0,30),ocean.id);await page.waitForFunction(id=>window.__cosmos.diagnostics().landing.visible&&window.__cosmos.diagnostics().landing.body===id,ocean.id,{timeout:20000});
 checks.push('Relaunch restores identical generated planets, system catalogs, textures and landable terrain');
 d=await state();assert.equal(d.shaderError,null);assert.deepEqual(errors,[]);
 await writeFile('test-output/systems-report.json',JSON.stringify({packaged:!!packaged,checks,diagnostics:d,errors},null,2));console.log(JSON.stringify({packaged:!!packaged,passed:checks.length,checks},null,2));
}catch(error){await page.screenshot({path:'test-output/systems-failure.png'}).catch(()=>{});console.error('Renderer errors:',errors);throw error;}
finally{await app.close();}
