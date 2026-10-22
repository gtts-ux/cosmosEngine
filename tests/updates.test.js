import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {UpdateManager,newerVersion,selectUpdate,RELEASE_API} from '../electron/updates.js';
const name='CosmosEngine-Mac-9.0.0-x64.dmg',payload=Buffer.from('test-installer-content'),base='https://github.com/gtts-ux/cosmosEngine/releases/download/v9.0.0/';
const release={tag_name:'v9.0.0',assets:[{name,size:payload.length,browser_download_url:base+name},{name:'SHA256SUMS.txt',browser_download_url:base+'SHA256SUMS.txt'}]};
test('updater selects only newer stable architecture-matching installers from the project',()=>{
 assert.ok(newerVersion('v1.10.0','1.9.0'));assert.equal(newerVersion('1.6.0','1.6.0'),false);assert.equal(newerVersion('1.7.0-beta','1.6.0'),false);
 assert.equal(selectUpdate(release,'1.6.0','x64').name,name);assert.equal(selectUpdate({...release,prerelease:true},'1.6.0','x64'),null);
 assert.throws(()=>selectUpdate({...release,assets:[{...release.assets[0],browser_download_url:'https://evil.test/app.dmg'},release.assets[1]]},'1.6.0','x64'));
 assert.throws(()=>selectUpdate(release,'1.6.0','arm64'));
});
test('download streams, checks SHA256, opens only a verified file, and rejects tampering',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cosmos-update-')),opened=[];
 const checksum=createHash('sha256').update(payload).digest('hex');
 const updater=new UpdateManager({version:'1.6.0',arch:'x64',directory,openInstaller:async p=>{opened.push(p);return '';},fetcher:async url=>new Response(url===RELEASE_API?JSON.stringify(release):url.endsWith('.txt')?`${checksum}  ${name}\n`:payload)});
 await assert.rejects(()=>updater.install());assert.equal((await updater.check()).status,'available');assert.equal((await updater.download()).status,'ready');assert.deepEqual(await readFile(path.join(directory,name)),payload);
 assert.equal((await updater.install()).opened,true);assert.equal(opened.length,1);
 await writeFile(path.join(directory,name),'modified');await assert.rejects(()=>updater.install(),/changed/);assert.equal(opened.length,1);
});
test('corrupt downloads never become installable and offline checks report a useful error',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cosmos-update-bad-'));
 const updater=new UpdateManager({version:'1.6.0',arch:'x64',directory,openInstaller:async()=>{throw new Error('must not open');},fetcher:async url=>new Response(url===RELEASE_API?JSON.stringify(release):url.endsWith('.txt')?`${'0'.repeat(64)}  ${name}\n`:payload)});
 await updater.check();assert.equal((await updater.download()).status,'error');await assert.rejects(()=>updater.install());
 const offline=new UpdateManager({version:'1.6.0',arch:'x64',directory,fetcher:async()=>{throw new Error('No internet connection');}});assert.equal((await offline.check()).status,'error');assert.match(offline.snapshot().message,/internet/);
});
