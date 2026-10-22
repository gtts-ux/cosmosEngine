import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {defaults} from '../electron/settings.js';
const root=process.cwd(),profile=path.join(root,'.performance-profile');await mkdir(profile,{recursive:true});await mkdir('test-output',{recursive:true});
await writeFile(path.join(profile,'settings.json'),JSON.stringify(defaults));await writeFile(path.join(profile,'worlds.json'),JSON.stringify({version:1,planets:[{hostId:'proxima-centauri',index:0,seed:'performance-ocean',type:'ocean',name:'Performance Ocean'}]}));
const packaged=process.env.COSMOS_PACKAGED_PATH,app=await electron.launch({...(packaged?{executablePath:packaged,args:[]}:{args:['.']}),cwd:root,env:{...process.env,COSMOS_TEST_PROFILE:profile}});
const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{await page.waitForFunction(()=>window.__cosmos?.ready||document.querySelector('#load-message')?.textContent.startsWith('Unable'),{},{timeout:90000});if(!await page.evaluate(()=>window.__cosmos?.ready))throw new Error(await page.locator('#load-message').textContent());await page.locator('#pause').click();
 const cases=[];for(const [id,altitude] of [['earth',20000000],['moon',100],['jupiter',280000000],['generated-proxima-centauri-performance-ocean-0',100]]){
  const start=Date.now();await page.evaluate(({id,altitude})=>id==='jupiter'?window.__cosmos.gasFlight(id,5):window.__cosmos.placeSunlit(id,altitude),{id,altitude});if(id==='jupiter')await page.waitForFunction(()=>window.__cosmos.bodyProbe('jupiter').textureWidth===4096,{},{timeout:20000});await page.waitForTimeout(1200);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const metrics=await page.evaluate(async()=>{const samples=[];let previous=performance.now(),deadline=previous+5000;while(performance.now()<deadline){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-previous);previous=now;}samples.sort((a,b)=>a-b);return {frames:samples.length,medianMS:samples[Math.floor(samples.length*.5)],p95MS:samples[Math.floor(samples.length*.95)],maxMS:samples.at(-1)};});
  const {profile:cpu}=await cdp.send('Profiler.stop');const top=cpu.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,12).map(n=>({name:n.callFrame.functionName,hits:n.hitCount,url:n.callFrame.url}));
  const diagnostics=await page.evaluate(()=>window.__cosmos.diagnostics());cases.push({id,altitude,arrivalMS:Date.now()-start-5000,...metrics,top,diagnostics});await page.screenshot({path:`test-output/performance-${id}.png`});await cdp.detach();
 }
 const result={packaged:!!packaged,cases,errors};await writeFile(`test-output/performance-${process.env.COSMOS_PERF_LABEL||'baseline'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({cases:cases.map(({id,arrivalMS,frames,medianMS,p95MS,maxMS,top})=>({id,arrivalMS,frames,medianMS,p95MS,maxMS,top})),errors},null,2));
}catch(e){console.error('Startup/runtime errors',errors);await page.screenshot({path:'test-output/performance-failure.png'});throw e;}finally{await app.close();}
