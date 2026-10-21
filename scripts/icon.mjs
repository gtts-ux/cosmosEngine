import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
export async function createIcon(page) {
  const svg=await readFile('build/icon.svg','utf8');
  const data=await page.evaluate(async svg=>{
    const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    await image.decode();
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
    canvas.getContext('2d').drawImage(image,0,0);
    return canvas.toDataURL('image/png').split(',')[1];
  },svg);
  await writeFile('build/icon.png',Buffer.from(data,'base64'));
  await mkdir('build/icon.iconset',{recursive:true});
  for(const size of [16,32,128,256,512]){
    for(const scale of [1,2]){
      execFileSync('sips',['-z',String(size*scale),String(size*scale),'build/icon.png','--out',`build/icon.iconset/icon_${size}x${size}${scale===2?'@2x':''}.png`],{stdio:'ignore'});
    }
  }
  execFileSync('iconutil',['-c','icns','build/icon.iconset','-o','build/icon.icns']);
}
