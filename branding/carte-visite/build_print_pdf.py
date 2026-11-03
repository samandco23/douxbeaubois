from pathlib import Path
from PIL import Image
import importlib.util, zlib

here=Path(__file__).parent; project=here.parents[1]
spec=importlib.util.spec_from_file_location('qr_generator',here/'generate_card.py')
qr=importlib.util.module_from_spec(spec);spec.loader.exec_module(qr)
scale=72/25.4; page_w=101*scale;page_h=71*scale
objects=[None,None,None]
def obj(data):
    if isinstance(data,str):data=data.encode('latin-1')
    objects.append(data);return len(objects)-1
def mm(n):return n*scale
def color(hexv):return tuple(int(hexv[i:i+2],16)/255 for i in (1,3,5))
def rgb(hexv):return ' '.join(f'{x:.4f}' for x in color(hexv))
def rect(x,top,w,h,fill,stroke=None,lw=.2):
    y=page_h-mm(top+h); c=f'{rgb(fill)} rg {mm(x):.3f} {y:.3f} {mm(w):.3f} {mm(h):.3f} re f\n'
    if stroke:c+=f'{rgb(stroke)} RG {mm(lw):.3f} w {mm(x):.3f} {y:.3f} {mm(w):.3f} {mm(h):.3f} re S\n'
    return c
def line(x1,top1,x2,top2,stroke,lw=.2):
    return f'{rgb(stroke)} RG {mm(lw):.3f} w {mm(x1):.3f} {page_h-mm(top1):.3f} m {mm(x2):.3f} {page_h-mm(top2):.3f} l S\n'
def text(x,baseline_top,txt,size,font='F1',fill='#21180f',align='left'):
    raw=txt.encode('cp1252','replace').hex().upper()
    if align=='center':
        # use approximate character advance, corrected for premium serif/sans face
        x-=len(txt)*size*(.25 if font in ('F1','F3') else .27)/scale
    return f'BT /{font} {size:.2f} Tf {rgb(fill)} rg 1 0 0 1 {mm(x):.3f} {page_h-mm(baseline_top):.3f} Tm <{raw}> Tj ET\n'
# Logo image XObject, flattened onto the exact front surface colour.
logo=Image.open(project/'public/logo-doux-beau-bois.png').convert('RGBA')
bg=Image.new('RGBA',logo.size,(23,19,15,255));bg.alpha_composite(logo);logo=bg.convert('RGB')
raw=zlib.compress(logo.tobytes(),9)
logo_obj=obj(f'<< /Type /XObject /Subtype /Image /Width {logo.width} /Height {logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length {len(raw)} >>\nstream\n'.encode()+raw+b'\nendstream')
def image_logo(x,top,w,h):
    y=page_h-mm(top+h)
    return f'q {mm(w):.3f} 0 0 {mm(h):.3f} {mm(x):.3f} {y:.3f} cm /Logo Do Q\n'
def crop_marks():
    s='';c='#17130f'
    for x1,y1,x2,y2 in [(6,8,7.5,8),(8,6,8,7.5),(93,8,95,8),(93,6,93,7.5),(6,63,7.5,63),(8,63,8,65),(93,63,95,63),(93,63,93,65)]:s+=line(x1,y1,x2,y2,c,.12)
    return s

def front():
    s=rect(5,5,91,61,'#17130f')+rect(10,10,81,51,'#17130f','#ba8b50',.12)
    s+=image_logo(33.5,18.5,34,34)
    return s+crop_marks()

def back():
    s=rect(5,5,91,61,'#f3ecdf')+rect(10,10,81,51,'#f3ecdf','#ba8b50',.12)
    s+=text(11.5,17.8,'CRÉATIONS EN BOIS · SUR MESURE',7.2,'F2','#9a7447')
    s+=text(11.5,26,'Le bois, pensé',16,'F1','#21180f')
    s+=text(11.5,32,'pour vos espaces.',16,'F1','#21180f')
    s+=text(11.5,38,'Mobilier sur mesure',8.1,'F2','#5d5346')
    s+=text(11.5,41.7,'Aménagement intérieur',8.1,'F2','#5d5346')
    s+=text(11.5,45.4,'Menuiserie & finitions',8.1,'F2','#5d5346')
    s+=line(11.5,48.7,49,48.7,'#c8b18e',.18)
    s+=text(11.5,55,'https://douxbeaubois.com',8.4,'F2','#815f39')
    q=qr.qr_matrix('https://douxbeaubois.com/')
    x0=60.5;top0=16;total=23.5;mod=total/33
    s+=rect(x0,top0,total,total,'#ffffff')
    for r,row in enumerate(q):
        for c,v in enumerate(row):
            if v:s+=rect(x0+(c+4)*mod,top0+(r+4)*mod,mod,mod,'#111111')
    s+=text(72.25,48,'SCANNER LE SITE',6.4,'F2','#7c5c37','center')
    return s+crop_marks()

fonts=[obj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>'),obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),obj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>'),obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]
fontdict=f'/F1 {fonts[0]} 0 R /F2 {fonts[1]} 0 R /F3 {fonts[2]} 0 R /F4 {fonts[3]} 0 R'
pages=[]
for content in (front(),back()):
 stream=content.encode('latin-1')
 content_obj=obj(f'<< /Length {len(stream)} >>\nstream\n'.encode()+stream+b'endstream')
 xobjects=f'/XObject << /Logo {logo_obj} 0 R >>' if content is not None else ''
 page_obj=obj(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w:.3f} {page_h:.3f}] /BleedBox [{mm(5):.3f} {mm(5):.3f} {mm(96):.3f} {mm(66):.3f}] /TrimBox [{mm(8):.3f} {mm(8):.3f} {mm(93):.3f} {mm(63):.3f}] /Resources << /Font << {fontdict} >> {xobjects} >> /Contents {content_obj} 0 R >>')
 pages.append(page_obj)
objects[1]=f'<< /Type /Catalog /Pages 2 0 R >>'.encode()
objects[2]=f'<< /Type /Pages /Kids [{" ".join(f"{n} 0 R" for n in pages)}] /Count 2 >>'.encode()
pdf=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');offsets=[0]
for i,o in enumerate(objects[1:],1):
 offsets.append(len(pdf));pdf.extend(f'{i} 0 obj\n'.encode());pdf.extend(o);pdf.extend(b'\nendobj\n')
xref=len(pdf);pdf.extend(f'xref\n0 {len(objects)}\n'.encode());pdf.extend(b'0000000000 65535 f \n')
for pos in offsets[1:]:pdf.extend(f'{pos:010d} 00000 n \n'.encode())
pdf.extend(f'trailer\n<< /Size {len(objects)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
(here/'carte-visite-recto-verso.pdf').write_bytes(pdf)
print('Generated two-page press PDF; trim 85x55 mm; bleed 3 mm.')
