from pathlib import Path
from lxml import html
import json
root=Path(__file__).resolve().parents[1];d=root/'dist';rows=[];errors=[];links=0;images=0
for p in sorted(d.rglob('*.html')):
 doc=html.fromstring(p.read_text());route='/' + str(p.relative_to(d).parent).replace('\\','/')+'/'
 if route=='/./':route='/'
 h1=doc.xpath('//main//h1');canon=doc.xpath('//link[@rel="canonical"]/@href');descs=doc.xpath('//meta[@name="description"]/@content')
 row={'file':str(p.relative_to(root)),'route':route,'title':doc.xpath('string(//title)'),'description':descs[0] if descs else '', 'h1':len(h1),'main_characters':len(doc.xpath('string(//main)').strip()),'canonical':canon[0] if canon else '', 'og':bool(doc.xpath('//meta[@property="og:title"]')),'jsonld':len(doc.xpath('//script[@type="application/ld+json"]')),'robots':doc.xpath('//meta[@name="robots"]/@content')[0]};rows.append(row)
 if len(h1)!=1:errors.append(f'{route}: expected one H1')
 if len(canon)!=1:errors.append(f'{route}: expected one canonical')
 for script in doc.xpath('//script[@type="application/ld+json"]'):json.loads(script.text)
 ids=doc.xpath('//@id')
 if len(ids)!=len(set(ids)):errors.append(f'{route}: duplicate DOM ID')
 for el in doc.xpath('//a[@href]|//img[@src]|//script[@src]|//link[@href]'):
  url=el.get('href') or el.get('src');links+=1
  if url.startswith('/'):
   target=d/url.split('#')[0].split('?')[0].lstrip('/')
   if target.is_dir():target=target/'index.html'
   if not target.exists():errors.append(f'{route}: missing local target {url}')
  if url.startswith('#') and url[1:] not in ids:errors.append(f'{route}: broken anchor {url}')
 for im in doc.xpath('//img'):
  images+=1
  if im.get('alt') is None:errors.append(f'{route}: missing image alt')
print(json.dumps({'pages':len(rows),'checked_link_asset_references':links,'images':images,'errors':errors,'rows':rows},indent=2))
Path('/tmp/qm-seo-after.json').write_text(json.dumps(rows,indent=2));Path('/tmp/qm-seo-checks.json').write_text(json.dumps({'links':links,'images':images,'errors':errors}))
if errors:raise SystemExit(1)
