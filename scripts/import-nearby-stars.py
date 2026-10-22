import csv,math,json,pathlib,hashlib,io,sys,urllib.request
SOURCE_URL='https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'
SOURCE_SHA256='d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd'
data=pathlib.Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else urllib.request.urlopen(SOURCE_URL,timeout=90).read()
if hashlib.sha256(data).hexdigest()!=SOURCE_SHA256:raise ValueError('HYG source checksum changed; review before updating the catalog.')
rows=list(csv.DictReader(io.StringIO(data.decode('utf-8'))))
near=sorted([r for r in rows if .1<float(r['dist'] or 1e9)<35 and r['id']==r['comp_primary']],key=lambda r:float(r['dist']))[:256]
alias={'Gl 559A':'Alpha Centauri A','Gl 71':'Tau Ceti','Gl 144':'Epsilon Eridani','Gl 820A':'61 Cygni A','Gl 845':'Epsilon Indi A','Gl 166A':'40 Eridani A','Gl 702A':'70 Ophiuchi A'}
colors={'O':'#a9beff','B':'#bdcdff','A':'#d5e4ff','F':'#f1f0ed','G':'#fff0cc','K':'#ffd0a1','M':'#ff9c72','D':'#d8e8ff'}
result=[]
for r in near:
 name=alias.get(r['gl']) or r['proper'] or r['gl'] or ('HIP '+r['hip'] if r['hip'] else 'HYG '+r['id'])
 spect=r['spect'] or 'M'; cls=spect.lstrip('sd').lstrip('d')[0].upper(); cls=cls if cls in colors else 'M'
 digits=''.join(c for c in spect if c.isdigit()); sub=int(digits[0]) if digits else 4
 mass={'O':16,'B':4,'A':1.8,'F':1.3,'G':1.02,'K':.78,'M':max(.085,.56-sub*.085),'D':.6}[cls]
 radius=.012 if cls=='D' else mass**.8
 lum=float(r['lum'] or 0); bol=.23*mass**2.3 if mass<.43 else mass**3.8
 ra=float(r['ra'])*math.pi/12;dec=float(r['dec'])*math.pi/180;dist=float(r['dist']);eps=math.radians(23.4392911)
 X=dist*math.cos(dec)*math.cos(ra);Y=dist*math.cos(dec)*math.sin(ra);Z=dist*math.sin(dec)
 anchor=[X*3.0856775814913673e13,(-Y*math.sin(eps)+Z*math.cos(eps))*3.0856775814913673e13,-(Y*math.cos(eps)+Z*math.sin(eps))*3.0856775814913673e13]
 id='proxima-centauri' if r['proper']=='Proxima Centauri' else 'alpha-centauri-a' if r['gl']=='Gl 559A' else 'star-hyg-'+r['id']
 result.append(dict(id=id,name=name,aliases=list(filter(None,[r['proper'],r['gl'],'HYG '+r['id']])),isStar=True,kind=cls+'-type star',radius=round(radius*695700,2),mass=mass*1.9885e30,period=0,gravity=round(274*mass/radius**2,2),atmosphere='Stellar plasma',color=colors[cls],texture='2k_sun.jpg',tilt=0,rotation=30,anchor=[round(v,2) for v in anchor],distanceLY=round(dist*3.261563777,4),spectralType=spect,luminosity=round(bol,7),catalogLuminosity=lum,catalogId='HYG '+r['id'],description=f'A nearby catalog star, {dist*3.261563777:.2f} light-years from the Sun. Position: HYG v4.1 (J2000). Mass and radius are spectral estimates. Planets you generate here are fictional.'))
p=pathlib.Path(__file__).resolve().parents[1]/'src/data/nearby-stars.js'
p.write_text('// Derived from HYG v4.1, David Nash / Astronomy Nexus. Data: CC BY-SA 4.0.\n// 256 nearby primary catalog entries; companion stars are not modeled.\n// Coordinates converted from J2000 equatorial to the renderer ecliptic frame.\nexport const NEARBY_STARS = '+json.dumps(result,indent=2)+';\n')
print('Selected',len(result),'stars; range',result[0]['distanceLY'],'to',result[-1]['distanceLY'],'ly')
print(', '.join(r['name'] for r in result))

with p.open("a") as out: out.write("\nNEARBY_STARS.forEach((star,i)=>{if(i>=55)star.streamedStar=true;});\n")
