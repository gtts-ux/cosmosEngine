// Approximate body-fixed ellipsoids with smooth, deterministic shape detail.
// Axis ratios come from published dimensions; these are not spacecraft shape models.
export function shapeFactor(body,[x,y,z]){
  if(!body.axes)return 1;
  const length=Math.hypot(x,y,z)||1;x/=length;y/=length;z/=length;
  const [a,b,c]=body.axes,mean=Math.cbrt(a*b*c);
  const ellipsoid=1/Math.sqrt((x*mean/a)**2+(y*mean/c)**2+(z*mean/b)**2);
  const bump=(body.irregularity||0)*Math.sin(x*5.1+z*2.7)*Math.cos(y*6.3-x*2.1)*Math.cos(z*4.8+y);
  const ridge=body.ridge?body.ridge*Math.exp(-((y/.13)**2)):0;
  return ellipsoid*(1+bump+ridge);
}
export function canLand(body){return body.id!=='sun'&&!['jupiter','saturn','uranus','neptune'].includes(body.id);}
export function approachScale(body){return Math.max(body.id==='saturn'||body.id==='uranus'?8.2:5.1,body.radius<150?120/body.radius:0);}
