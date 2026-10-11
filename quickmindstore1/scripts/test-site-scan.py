"""Regression checks for structural improvements across the generated site."""
from pathlib import Path
from lxml import html
from PIL import Image
import json
root=Path(__file__).resolve().parents[1];dist=root/'dist';pages=0;images=0;skip=0
for f in dist.rglob('*.html'):
 d=html.fromstring(f.read_text());pages+=1
 if d.xpath('//link[@href="/languages.css"]'):
  assert d.xpath('//a[@class="skip-link" and @href="#app"]'),f
  assert d.xpath('//main[@id="app" and @tabindex="-1"]'),f
  assert len(d.xpath('//header/nav/a'))==6,f
  skip+=1
 for im in d.xpath('//main//img[starts-with(@src,"/assets/")]'):
  with Image.open(dist/im.get('src').lstrip('/')) as original:size=original.size
  assert (int(im.get('width','0')),int(im.get('height','0')))==size,(f,im.get('src'))
  images+=1
print(json.dumps({'pages':pages,'images_with_verified_dimensions':images,'pages_with_six_menus_and_skip_links':skip,'errors':0}))
