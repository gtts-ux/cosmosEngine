"""Convert reviewed local source rasters; inputs: NASA GEBCO BMP and MOLA IMG.
Earth is a normalized display raster, so heights are approximate (0–8000 m).
Mars is signed 16-bit MOLA elevation in meters; longitude rotated to -180..180.
"""
import pathlib,struct,hashlib,json,sys,gzip
root=pathlib.Path(__file__).resolve().parents[1]
earth=pathlib.Path(sys.argv[1]).read_bytes();mars=pathlib.Path(sys.argv[2]).read_bytes()
offset=struct.unpack_from('<I',earth,10)[0]
assert struct.unpack_from('<ii',earth,18)==(1440,-720)
assert len(mars)==1440*720*2
values=[round(earth[offset+i*3]*8000/255) for i in range(1440*720)]
for name,vals in [('earth',values),('mars',[struct.unpack_from('>h',mars,(y*1440+(x+720)%1440)*2)[0] for y in range(720) for x in range(1440)])]:
 data=struct.pack('<'+'h'*len(vals),*vals);path=root/'assets/data'/f'{name}-elevation.bin.gz';path.write_bytes(gzip.compress(data,mtime=0));print(name,min(vals),max(vals),hashlib.sha256(data).hexdigest())
