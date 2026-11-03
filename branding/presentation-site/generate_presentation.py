from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance

ROOT=Path(__file__).resolve().parents[2]; OUT=Path(__file__).parent; PUB=ROOT/'public'
W,H=1440,900
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'; SERIF_B='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'; SANS='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; SANS_B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
GOLD='#d3ab73'; INK='#211910'; PAPER='#f3ecdf'; MUTED='#bdb2a2'

def font(path,size):return ImageFont.truetype(path,size)
def crop(im,size,center=(.5,.5)):
 im=im.convert('RGB'); w,h=im.size;tw,th=size;scale=max(tw/w,th/h);im=im.resize((round(w*scale),round(h*scale)),Image.Resampling.LANCZOS);x=round((im.width-tw)*center[0]);y=round((im.height-th)*center[1]);return im.crop((x,y,x+tw,y+th))
def browser(im,title):
 d=ImageDraw.Draw(im);d.rectangle((0,0,W,42),fill='#292a2c');d.rounded_rectangle((120,8,1115,34),radius=8,fill='#414244');d.text((143,13),'douxbeaubois.com  ·  '+title,font=font(SANS,13),fill='#f5f5f5');d.text((1160,13),'—   □   ×',font=font(SANS,13),fill='#ddd');return im
def logo(d,box,background=None):
 img=Image.open(PUB/'logo-doux-beau-bois.png').convert('RGBA');img.thumbnail((box[2],box[3]),Image.Resampling.LANCZOS);x=box[0]+(box[2]-img.width)//2;y=box[1]+(box[3]-img.height)//2
 if background:d.rectangle((box[0],box[1],box[0]+box[2],box[1]+box[3]),fill=background)
 d._image.alpha_composite(img,(x,y))
def draw_logo(im,box,bg=None):
 layer=im.convert('RGBA');d=ImageDraw.Draw(layer);logo(d,box,bg);return layer.convert('RGB')
def header(im,scrolled=False):
 d=ImageDraw.Draw(im); y0=42
 if scrolled:d.rectangle((0,y0,W,y0+86),fill='#fffdfa')
 else:d.rectangle((0,y0,W,y0+86),fill=(20,15,10,90))
 # use transparent logo on pale header; gold blends visibly
 layer=im.convert('RGBA'); logo(ImageDraw.Draw(layer),(110,y0+4,80,78),None);im.paste(layer.convert('RGB'))
 fg=INK if scrolled else 'white'
 for x,label in [(760,'Accueil'),(855,'Catalogue'),(970,'À propos'),(1077,'Contact')]:ImageDraw.Draw(im).text((x,y0+34),label,font=font(SANS,15),fill=fg)
 d=ImageDraw.Draw(im);d.rounded_rectangle((1174,y0+17,1373,y0+66),radius=3,fill=GOLD);d.text((1190,y0+33),'PARLER DU PROJET',font=font(SANS_B,12),fill=INK)
def button(d,xy,label,primary=True):
 x,y,w,h=xy;fill=GOLD if primary else '#f5f0e7';d.rectangle((x,y,x+w,y+h),fill=fill,outline=None if primary else '#c8b38f',width=1);d.text((x+18,y+15),label,font=font(SANS_B,14),fill=INK)

def portal():
 im=crop(Image.open(PUB/'hero-interior.png'),(W,H-42),(.52,.52)); im=ImageEnhance.Brightness(im).enhance(.55); im=ImageEnhance.Color(im).enhance(.75); im=browser(im,'Accueil');header(im,False);d=ImageDraw.Draw(im)
 d.text((125,295),'L’ART DU BOIS, LE GOÛT DU BEAU',font=font(SANS_B,13),fill='#e7c995')
 d.text((123,342),'Le bois travaillé.',font=font(SERIF_B,55),fill='white');d.text((123,409),'L’élégance révélée.',font=font(SERIF,50),fill='#e7c995')
 d.text((126,488),'Des créations en bois pensées pour vos espaces,',font=font(SANS,18),fill='#f5eee4');d.text((126,519),'façonnées avec soin et imaginées pour durer.',font=font(SANS,18),fill='#f5eee4')
 button(d,(126,580,250,52),'DÉCOUVRIR LE CATALOGUE');d.text((400,596),'Présentez-nous votre projet  →',font=font(SANS,15),fill='white');d.rounded_rectangle((1194,817,1390,869),radius=26,fill='#1faa59');d.text((1212,835),'WhatsApp  ·  +237 696 52 50 45',font=font(SANS_B,10),fill='white')
 # modal card
 d.rectangle((0,42,W,H),fill=(15,11,7,150));cx,cy,cw,ch=268,177,904,555;d.rectangle((cx,cy,cx+cw,cy+ch),fill=PAPER)
 # use photo panel
 photo=crop(Image.open(PUB/'hero-interior.png'),(340,ch),(.25,.5));im.paste(photo,(cx,cy));d=ImageDraw.Draw(im)
 layer=im.convert('RGBA');logo(ImageDraw.Draw(layer),(770,198,92,92),None);im.paste(layer.convert('RGB'));d=ImageDraw.Draw(im)
 d.text((717,302),'LE BOIS TRAVAILLÉ, L’ÉLÉGANCE RÉVÉLÉE',font=font(SANS,11),fill='#8e693e')
 d.text((716,341),'Bienvenue dans notre univers',font=font(SERIF,27),fill=INK)
 d.text((739,385),'Découvrez nos créations et notre savoir-faire.',font=font(SANS,13),fill='#6a5d4c')
 button(d,(664,423,512,52),'CONTINUER VERS LE SITE')
 d.rectangle((664,486,1176,536),fill=PAPER,outline='#bd9d6e',width=1);d.text((720,502),'ENTRER DIRECTEMENT DANS LE CATALOGUE',font=font(SANS_B,12),fill=INK)
 d.text((785,558),'OU RETROUVEZ-NOUS SUR',font=font(SANS_B,10),fill='#917a5d')
 for j,(abbr,name) in enumerate([('IG','Instagram'),('f','Facebook'),('♪','TikTok')]):
  x=704+j*144;d.rounded_rectangle((x,583,x+132,625),radius=20,fill='#fff9ef',outline='#d6c8b3');d.text((x+15,595),abbr,font=font(SANS_B,12),fill='#8d693e');d.text((x+42,596),name,font=font(SANS,11),fill='#493a28')
 return im

def home():
 im=crop(Image.open(PUB/'hero-interior.png'),(W,H-42),(.54,.5));im=ImageEnhance.Brightness(im).enhance(.60);im=browser(im,'Accueil');header(im,False);d=ImageDraw.Draw(im)
 d.text((112,259),'L’ART DU BOIS, LE GOÛT DU BEAU',font=font(SANS_B,12),fill='#e6c99b');d.text((110,307),'Le bois travaillé.',font=font(SERIF_B,54),fill='white');d.text((110,370),'L’élégance révélée.',font=font(SERIF,52),fill='#e6c99b');d.text((113,450),'Des créations en bois pensées pour vos espaces, façonnées avec soin',font=font(SANS,17),fill='white')
 button(d,(112,508,244,50),'VOIR LE CATALOGUE');d.text((390,526),'Parlons de votre projet  →',font=font(SANS,15),fill='white');d.rounded_rectangle((1195,817,1390,869),radius=26,fill='#1faa59');d.text((1211,835),'WhatsApp  ·  +237 696 52 50 45',font=font(SANS_B,10),fill='white')
 # section below fold cue
 d.rectangle((0,650,W,H),fill=PAPER);d.text((105,692),'L’ART DU BOIS, AU QUOTIDIEN',font=font(SANS_B,11),fill='#9b7545');d.text((105,724),'Des matières nobles. Des espaces qui vous ressemblent.',font=font(SERIF,29),fill=INK);d.text((105,779),'Mobilier sur mesure    ·    Aménagement intérieur    ·    Finitions & détails',font=font(SANS,15),fill='#665b4f')
 return im

def catalog():
 im=Image.new('RGB',(W,H),'#f3ecdf');im=browser(im,'Catalogue');header(im,True);d=ImageDraw.Draw(im)
 d.rectangle((0,128,W,338),fill='#241b13');d.text((120,185),'DOUX BEAU BOIS  ·  NOS CRÉATIONS',font=font(SANS_B,12),fill=GOLD);d.text((118,222),'Le catalogue',font=font(SERIF,44),fill='#fff5e8');d.text((120,285),'Exemples de mobilier et d’aménagement sur mesure.',font=font(SANS,16),fill='#dfd1bd')
 d.text((120,370),'CATALOGUE DE DÉMONSTRATION · CONTENUS ET PRIX FICTIFS',font=font(SANS_B,11),fill='#82633d')
 items=[('demo-table.png','Table de salle à manger en noyer','Salle à manger','450 000 FCFA · EXEMPLE'),('demo-bed.png','Lit signature en teck','Chambre','680 000 FCFA · EXEMPLE'),('demo-desk.png','Bureau artisanal en noyer','Bureau','320 000 FCFA · EXEMPLE')]
 for i,(file,title,cat,price) in enumerate(items):
  x=120+i*405;y=410;pic=crop(Image.open(PUB/file),(365,245),(.5,.5));im.paste(pic,(x,y));d=ImageDraw.Draw(im);d.text((x,y+260),cat.upper(),font=font(SANS_B,10),fill='#9b7545');d.text((x,y+281),title,font=font(SERIF,18),fill=INK);d.text((x,y+315),price,font=font(SANS,13),fill='#6b5d4d');d.rectangle((x,y+347,x+160,y+386),fill=GOLD);d.text((x+14,y+359),'DEMANDER UN DEVIS',font=font(SANS_B,10),fill=INK)
 return im

def services():
 im=Image.new('RGB',(W,H),'#f3ecdf');im=browser(im,'Notre univers');header(im,True);d=ImageDraw.Draw(im)
 d.text((112,166),'NOTRE SAVOIR-FAIRE',font=font(SANS_B,11),fill='#9b7545');d.text((110,196),'Le bois, façonné pour vous.',font=font(SERIF,34),fill=INK)
 cards=[('01','Mobilier sur mesure','Des pièces adaptées à vos espaces, vos usages et vos envies.'),('02','Aménagement intérieur','Le bois donne du relief et une identité singulière à votre intérieur.'),('03','Finitions & détails','Des matières choisies et des finitions soignées jusque dans les détails.')]
 for i,(num,title,body) in enumerate(cards):
  x=110+i*410;d.rectangle((x,258,x+376,445),fill='#fcfbf9',outline='#e1d8cb',width=1);d.text((x+22,278),num,font=font(SANS,12),fill='#aa8a5d');d.text((x+22,316),title,font=font(SERIF,21),fill=INK);d.multiline_text((x+22,358),body,font=font(SANS,13),fill='#756d63',spacing=6)
 # Featured action strip
 d.rectangle((0,488,W,760),fill='#211810');pic=crop(Image.open(PUB/'hero-interior.png'),(580,272),(.28,.5));im.paste(pic,(0,488));d=ImageDraw.Draw(im);d.text((640,526),'UN SAVOIR-FAIRE, MILLE POSSIBILITÉS',font=font(SANS_B,11),fill=GOLD);d.text((638,562),'Imaginé avec vous.',font=font(SERIF,28),fill='#f4ebdf');d.text((638,600),'Réalisé avec soin.',font=font(SERIF,28),fill=GOLD);d.text((640,656),'Chaque projet commence par une conversation.',font=font(SANS,13),fill='#d3c7b8');button(d,(640,694,230,45),'PRÉSENTER MON PROJET')
 d.rectangle((0,760,W,H),fill='#17130f');d.text((107,784),'DOUX BEAU BOIS',font=font(SERIF_B,16),fill='#f0dfc6');d.text((107,812),'Le bois travaillé, l’élégance révélée',font=font(SANS,11),fill='#b9aa95');d.text((510,785),'ACCUEIL    CATALOGUE    À PROPOS    CONTACT',font=font(SANS,12),fill='#d1c7b9');d.text((107,865),'© Doux Beau Bois',font=font(SANS,10),fill='#9f9486');d.text((1050,865),'Site réalisé par Alpha Omega Corporation',font=font(SANS,10),fill='#c2ad8e');return im

def mobile():
 sw,sh=430,860; im=crop(Image.open(PUB/'hero-interior.png'),(sw,sh),(.48,.5));im=ImageEnhance.Brightness(im).enhance(.55);d=ImageDraw.Draw(im);d.rectangle((0,0,sw,75),fill=(20,15,10,135));layer=im.convert('RGBA');logo(ImageDraw.Draw(layer),(20,7,63,62),None);im.paste(layer.convert('RGB'));d=ImageDraw.Draw(im);d.text((337,27),'☰',font=font(SANS_B,22),fill='white');d.text((25,233),'L’ART DU BOIS',font=font(SANS_B,10),fill='#e4c48f');d.text((23,275),'Le bois',font=font(SERIF_B,41),fill='white');d.text((23,323),'travaillé.',font=font(SERIF_B,41),fill='white');d.text((23,375),'L’élégance',font=font(SERIF,37),fill='#e4c48f');d.text((23,421),'révélée.',font=font(SERIF,37),fill='#e4c48f');d.text((25,505),'Des créations pensées pour vos espaces,',font=font(SANS,13),fill='white');d.text((25,530),'façonnées avec soin et imaginées pour durer.',font=font(SANS,12),fill='white');button(d,(25,580,280,50),'DÉCOUVRIR LE CATALOGUE');d.text((25,650),'Présentez-nous votre projet  →',font=font(SANS,13),fill='white');d.rounded_rectangle((205,785,410,840),radius=26,fill='#1faa59');d.text((223,803),'WhatsApp · +237 696 52 50 45',font=font(SANS_B,10),fill='white');return im

screens=[('porte-entree-desktop.png',portal()),('accueil-desktop.png',home()),('savoir-faire-desktop.png',services()),('catalogue-desktop.png',catalog()),('accueil-mobile.png',mobile())]
for name,im in screens:im.save(OUT/name,optimize=True)
# Client review PDF: one visual per page, presentation only, no admin view.
pages=[]
for name,im in screens:
 im=im.convert('RGB');pages.append(im.resize((1440,900),Image.Resampling.LANCZOS))
pages[0].save(OUT/'presentation-visuelle-site.pdf',save_all=True,append_images=pages[1:],resolution=144.0)
print('Created 5 presentation captures and a 5-page client PDF.')
