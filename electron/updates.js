import path from 'node:path';
import {mkdir,open,rename,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const RELEASE_API='https://api.github.com/repos/gtts-ux/cosmosEngine/releases/latest';
const MAX_INSTALLER=512*1024*1024;
export function newerVersion(a,b){
 const parse=s=>/^v?\d+\.\d+\.\d+$/.test(s)?s.replace(/^v/,'').split('.').map(Number):null;
 const A=parse(a),B=parse(b);if(!A||!B)return false;
 for(let i=0;i<3;i++)if(A[i]!==B[i])return A[i]>B[i];return false;
}
export function selectUpdate(release,current,arch){
 if(!release||release.draft||release.prerelease||!newerVersion(release.tag_name,current))return null;
 if(!['x64','arm64'].includes(arch))throw new Error('This Mac architecture is not supported.');
 const version=release.tag_name.replace(/^v/,''),name=`CosmosEngine-Mac-${version}-${arch}.dmg`;
 const asset=release.assets?.find(a=>a.name===name),checksums=release.assets?.find(a=>a.name==='SHA256SUMS.txt');
 const allowed=(a,filename)=>a?.browser_download_url===`https://github.com/gtts-ux/cosmosEngine/releases/download/v${version}/${filename}`;
 if(!allowed(asset,name)||!allowed(checksums,'SHA256SUMS.txt')||!Number.isInteger(asset.size)||asset.size<=0||asset.size>MAX_INSTALLER)throw new Error('The latest release has no valid installer for this Mac.');
 return {version,name,url:asset.browser_download_url,checksumURL:checksums.browser_download_url,size:asset.size};
}
async function bytes(response,limit){
 if(!response.ok)throw new Error(`Update server returned HTTP ${response.status}.`);
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Update response exceeded its size limit.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
export class UpdateManager {
 constructor({version,arch,directory,fetcher,openInstaller}){Object.assign(this,{version,arch,directory,fetcher,openInstaller});this.state={status:'idle',current:version,version:null,progress:0,message:'Check GitHub for a newer version.'};}
 snapshot(){return {...this.state};}
 request(url){return this.fetcher(url,{headers:{'User-Agent':`CosmosEngine-Mac/${this.version}`,'Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(120000)});}
 async check(){
  if(this.work)return this.work;
  const task=(async()=>{try{this.state={...this.state,status:'checking',message:'Checking for updates…'};const release=JSON.parse((await bytes(await this.request(RELEASE_API),1024*1024)).toString());this.update=selectUpdate(release,this.version,this.arch);this.state={...this.state,status:this.update?'available':'current',version:this.update?.version||this.version,progress:0,message:this.update?`Version ${this.update.version} is available.`:'You have the latest version.'};}catch(e){this.state={...this.state,status:'error',message:e.message};}return this.snapshot();})();this.work=task;try{return await task;}finally{this.work=null;}
 }
 async download(){
  if(this.work)return this.work;
  if(!this.update||!['available','error','ready'].includes(this.state.status))throw new Error('Check for an available update first.');
  if(this.state.status==='ready')return this.snapshot();
  const update=this.update,temporary=path.join(this.directory,update.name+'.partial');
  const task=(async()=>{let file;try{
   this.state={...this.state,status:'downloading',progress:0,message:'Downloading and verifying the Mac installer…'};
   const sums=(await bytes(await this.request(update.checksumURL),65536)).toString();
   const line=sums.split(/\r?\n/).find(line=>line.trim().split(/\s+\*?/)[1]===update.name);
   const expected=line?.match(/^([a-f0-9]{64})\s+/i)?.[1]?.toLowerCase();if(!expected)throw new Error('The release checksum is missing.');
   const response=await this.request(update.url);if(!response.ok)throw new Error(`Installer download returned HTTP ${response.status}.`);
   await mkdir(this.directory,{recursive:true});file=await open(temporary,'w',0o600);const hash=createHash('sha256');let count=0;
   for await(const chunk of response.body){count+=chunk.length;if(count>update.size||count>MAX_INSTALLER)throw new Error('Installer size does not match the release.');hash.update(chunk);await file.write(Buffer.from(chunk));this.state.progress=count/update.size;}
   await file.close();file=null;if(count!==update.size||hash.digest('hex')!==expected)throw new Error('Installer verification failed. Please download again.');
   this.verified=path.join(this.directory,update.name);this.expectedHash=expected;await rename(temporary,this.verified);this.state={...this.state,status:'ready',progress:1,message:'Installer verified. Open it, quit CosmosEngine, and drag the new app into Applications to replace it. Your saved worlds stay on this Mac.'};
  }catch(e){await file?.close().catch(()=>{});await rm(temporary,{force:true}).catch(()=>{});this.state={...this.state,status:'error',message:e.message};}return this.snapshot();})();
  this.work=task;try{return await task;}finally{this.work=null;}
 }
 async install(){
  if(this.state.status!=='ready'||!this.verified)throw new Error('Download and verify an update first.');
  if(createHash('sha256').update(await readFile(this.verified)).digest('hex')!==this.expectedHash)throw new Error('The downloaded installer changed. Download it again.');
  const error=await this.openInstaller(this.verified);if(error)throw new Error(error);return {...this.snapshot(),opened:true};
 }
}
