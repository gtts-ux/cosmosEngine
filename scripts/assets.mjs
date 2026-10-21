import { readFile,mkdir,writeFile,rename,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function ensureAssets(){
  const entries=JSON.parse(await readFile('assets/manifest.json','utf8'));
  await mkdir('assets/textures',{recursive:true});
  let cursor=0,downloaded=0;
  async function worker(){
    while(cursor<entries.length){
      const entry=entries[cursor++],destination=`assets/textures/${entry.file}`;
      try{if((await stat(destination)).size>100&&hash(await readFile(destination))===entry.outputSha256)continue;}catch{}
      let error;
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await fetch(entry.url,{signal:AbortSignal.timeout(90000)});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const data=Buffer.from(await response.arrayBuffer());
          if(hash(data)!==entry.sha256)throw new Error('Source checksum changed; review the upstream asset before updating its manifest.');
          const temporary=destination+(entry.convertToPng?'.source.tif':'.download');await writeFile(temporary,data);
          if(entry.convertToPng)execFileSync('sips',['-s','format','png',temporary,'--out',destination],{stdio:'ignore'});
          else await rename(temporary,destination);
          downloaded++;error=null;break;
        }catch(e){error=e;}
      }
      if(error)throw new Error(`Cannot prepare ${entry.file}: ${error.message}`);
    }
  }
  await Promise.all(Array.from({length:4},worker));
  if(downloaded)console.log(`Prepared ${downloaded} verified local assets. The built app runs offline.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await ensureAssets();
