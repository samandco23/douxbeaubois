from pathlib import Path
import base64, json, math
from PIL import Image, ImageDraw
from xml.sax.saxutils import escape

root=Path(__file__).resolve().parents[2]
out=Path(__file__).parent
url='https://douxbeaubois.com/'

def gf_mul(x,y):
    r=0
    while y:
        if y&1:r^=x
        y>>=1;x<<=1
        if x&0x100:x^=0x11d
    return r

def rs_remainder(data,degree):
    gen=[1]
    root=1
    for i in range(degree):
        nxt=[0]*(len(gen)+1)
        for j,c in enumerate(gen):
            nxt[j]^=c;nxt[j+1]^=gf_mul(c,root)
        gen=nxt;root=gf_mul(root,2)
    msg=list(data)+[0]*degree
    for i in range(len(data)):
        coef=msg[i]
        if coef:
            for j,g in enumerate(gen):msg[i+j]^=gf_mul(coef,g)
    return msg[-degree:]

def qr_matrix(payload):
    # Use libqrencode to create a standards-compliant QR matrix (auto-sized, level L).
    import ctypes
    class QRcode(ctypes.Structure):
        _fields_=[('version',ctypes.c_int),('width',ctypes.c_int),('data',ctypes.POINTER(ctypes.c_ubyte))]
    lib=ctypes.CDLL('libqrencode.so.4')
    lib.QRcode_encodeString8bit.argtypes=[ctypes.c_char_p,ctypes.c_int,ctypes.c_int]
    lib.QRcode_encodeString8bit.restype=ctypes.POINTER(QRcode)
    lib.QRcode_free.argtypes=[ctypes.POINTER(QRcode)]
    result=lib.QRcode_encodeString8bit(payload.encode('utf-8'),0,0)
    if not result:raise RuntimeError('QR encoding failed')
    width=result.contents.width
    matrix=[[bool(result.contents.data[r*width+c]&1) for c in range(width)] for r in range(width)]
    lib.QRcode_free(result)
    return matrix

matrix=qr_matrix(url)
quiet=4;n=len(matrix);size=n+quiet*2
path=[]
for r,row in enumerate(matrix):
    for c,v in enumerate(row):
        if v:path.append(f'M{c+quiet} {r+quiet}h1v1h-1z')
qr_svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="{"".join(path)}" fill="#111"/></svg>'
(out/'qr-site.svg').write_text(qr_svg)
# Render a PNG QR with a substantial quiet zone for easy phone scanning.
scale=12; img=Image.new('RGB',(size*scale,size*scale),'white');draw=ImageDraw.Draw(img)
for y,row in enumerate(matrix):
 for x,v in enumerate(row):
  if v:draw.rectangle(((x+quiet)*scale,(y+quiet)*scale,(x+quiet+1)*scale-1,(y+quiet+1)*scale-1),fill='#111111')
img.save(out/'qr-site.png')
logo=base64.b64encode((root/'public/logo-doux-beau-bois.png').read_bytes()).decode()
qr64=base64.b64encode(qr_svg.encode()).decode()
# SVGs have 3 mm full bleed around the 85 x 55 mm trim size.
front=f'''<svg xmlns="http://www.w3.org/2000/svg" width="91mm" height="61mm" viewBox="0 0 910 610"><rect width="910" height="610" fill="#17130f"/><rect x="28" y="28" width="854" height="554" fill="none" stroke="#ba8b50" stroke-width="1.2"/><image x="275" y="125" width="360" height="360" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{logo}"/></svg>'''
back=f'''<svg xmlns="http://www.w3.org/2000/svg" width="91mm" height="61mm" viewBox="0 0 910 610"><rect width="910" height="610" fill="#f3ecdf"/><rect x="28" y="28" width="854" height="554" fill="none" stroke="#ba8b50" stroke-width="1.2"/><text x="115" y="178" fill="#9a7447" font-family="Arial,sans-serif" font-size="22" letter-spacing="3">CRÉATIONS EN BOIS · SUR MESURE</text><text x="115" y="260" fill="#21180f" font-family="Georgia,serif" font-size="48">Le bois, pensé</text><text x="115" y="318" fill="#21180f" font-family="Georgia,serif" font-size="48">pour vos espaces.</text><text x="115" y="383" fill="#5d5346" font-family="Arial,sans-serif" font-size="23">Mobilier sur mesure</text><text x="115" y="419" fill="#5d5346" font-family="Arial,sans-serif" font-size="23">Aménagement intérieur</text><text x="115" y="455" fill="#5d5346" font-family="Arial,sans-serif" font-size="23">Menuiserie &amp; finitions</text><line x1="115" y1="493" x2="490" y2="493" stroke="#c8b18e" stroke-width="2"/><text x="115" y="548" fill="#815f39" font-family="Arial,sans-serif" font-size="26">{escape(url)}</text><rect x="605" y="160" width="235" height="235" rx="4" fill="#fff"/><image x="612.5" y="167.5" width="220" height="220" href="data:image/svg+xml;base64,{qr64}"/><text x="722.5" y="480" text-anchor="middle" fill="#7c5c37" font-family="Arial,sans-serif" font-size="20" letter-spacing="2">SCANNER LE SITE</text></svg>'''
(out/'carte-recto.svg').write_text(front)
(out/'carte-verso.svg').write_text(back)
# Two-page print PDF, with 3 mm bleed artwork and crop marks outside the bleed.
html='''<!doctype html><html><head><meta charset="utf-8"><style>@page{size:101mm 71mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}.sheet{width:101mm;height:71mm;position:relative;page-break-after:always}.sheet:last-child{page-break-after:auto}.art{position:absolute;left:5mm;top:5mm;width:91mm;height:61mm}.art img{width:100%;height:100%;display:block}.mark{position:absolute;background:#111}.h{height:.12mm;width:2mm}.v{width:.12mm;height:2mm}.tlh{left:6mm;top:8mm}.tlv{left:8mm;top:6mm}.trh{left:93mm;top:8mm}.trv{left:93mm;top:6mm}.blh{left:6mm;top:63mm}.blv{left:8mm;top:63mm}.brh{left:93mm;top:63mm}.brv{left:93mm;top:63mm}</style></head><body>'''
for filename in ['carte-recto.svg','carte-verso.svg']:
 html+=f'<div class="sheet"><div class="art"><img src="{filename}"></div><i class="mark h tlh"></i><i class="mark v tlv"></i><i class="mark h trh"></i><i class="mark v trv"></i><i class="mark h blh"></i><i class="mark v blv"></i><i class="mark h brh"></i><i class="mark v brv"></i></div>'
html+='</body></html>'
(out/'print.html').write_text(html)
print('QR matrix',n,'x',n,'URL',url)
