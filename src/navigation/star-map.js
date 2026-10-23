import {LIGHT_YEAR_KM} from '../data/systems.js';

// A separate map camera keeps navigation and the streaming center on the player.
export class LocalStarMap {
  constructor({flight,stars,travel,region}){
    this.flight=flight;this.stars=stars;this.travel=travel;this.region=region;
    this.dialog=document.getElementById('star-map-dialog');this.canvas=document.getElementById('star-map-canvas');
    this.list=document.getElementById('star-map-target');this.go=document.getElementById('star-map-go');this.selected=null;this.angle=.35;
    this.dialog.querySelector('.dialog-close').onclick=()=>this.dialog.close();
    this.list.onchange=()=>{this.selected=this.list.value;this.paint();};
    this.go.onclick=()=>{if(this.selected){const id=this.selected;this.dialog.close();this.travel(id);}};
    document.getElementById('star-map-rotate').onclick=()=>{this.angle+=Math.PI/4;this.paint();};
    this.canvas.onclick=e=>{const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)*this.width/r.width,y=(e.clientY-r.top)*this.height/r.height;
      const hit=this.points?.filter(p=>Math.hypot(p.x-x,p.y-y)<12).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
      if(hit){this.selected=hit.id;this.list.value=hit.id;this.paint();}
    };
  }
  open(){this.flight.keys.clear();this.flight.velocity.set(0,0,0);this.dialog.showModal();this.paint();}
  paint(){
    if(!this.dialog.open)return;
    this.center=this.flight.position.toArray().map((v,i)=>(v*1000+this.flight.universe.referenceAnchor[i])/LIGHT_YEAR_KM);
    const entries=this.stars().map(b=>({b,d:(b.anchor||[0,0,0]).map((v,i)=>v/LIGHT_YEAR_KM-this.center[i])})).sort((a,b)=>Math.hypot(...a.d)-Math.hypot(...b.d));
    const signature=entries.map(e=>e.b.id).join('|');
    if(signature!==this.signature){this.signature=signature;this.list.replaceChildren();
      for(const {b,d} of entries){const option=document.createElement('option');option.value=b.id;option.textContent=`${b.name} · ${Math.hypot(...d).toFixed(2)} ly · ${b.fictional?'fictional':'catalog'}`;this.list.append(option);}
      if(!entries.some(e=>e.b.id===this.selected))this.selected=entries[0]?.b.id||null;
      this.list.value=this.selected||'';
    }
    this.go.disabled=!this.selected;document.getElementById('star-map-summary').textContent=`${this.region()} · ${entries.length} stars within 10 ly of you`;
    const rect=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);this.width=rect.width;this.height=rect.height;
    const width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const ctx=this.canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    const cx=rect.width/2,cy=rect.height/2,scale=Math.min(rect.width,rect.height)*.043;
    ctx.strokeStyle='#314253';ctx.fillStyle='#8199b0';ctx.font='11px system-ui';
    for(const ly of [5,10]){ctx.beginPath();ctx.ellipse(cx,cy,ly*scale,ly*scale,0,0,Math.PI*2);ctx.stroke();ctx.fillText(`${ly} ly`,cx+5,cy-ly*scale+15);}
    const cos=Math.cos(this.angle),sin=Math.sin(this.angle);this.points=[];
    for(const {b,d} of entries){const x=cx+(d[0]*cos-d[2]*sin)*scale,y=cy+(d[0]*sin+d[2]*cos)*scale*.85-d[1]*scale*.5;
      this.points.push({id:b.id,x,y});ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(x,y,b.id===this.selected?5:3,0,Math.PI*2);ctx.fill();
      if(b.id===this.selected){ctx.strokeStyle='#d4edff';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d4edff';ctx.fillText(b.name.slice(0,32),Math.min(x+12,rect.width-210),Math.max(15,y-10));}
    }
    ctx.strokeStyle='#70ebcb';ctx.beginPath();ctx.moveTo(cx-7,cy);ctx.lineTo(cx+7,cy);ctx.moveTo(cx,cy-7);ctx.lineTo(cx,cy+7);ctx.stroke();ctx.fillStyle='#70ebcb';ctx.fillText('You',cx+10,cy+17);
  }
  diagnostics(){return {open:this.dialog.open,centerLY:this.center,stars:this.points?.map(p=>p.id)||[]};}
}
