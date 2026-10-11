"""Idempotent static SEO/GEO enrichment. Keeps the private preview private."""
from pathlib import Path
from lxml import html, etree
from urllib.parse import urlparse
import json, re, collections
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist'
cfg=json.loads((ROOT/'seo-config.json').read_text());ORIGIN=cfg['origin'];LANGS=['en','zh-CN','es','fr','de','ja','ko','id']
copy={l:json.loads((ROOT/'locales'/f'{l}.json').read_text()) for l in LANGS[1:]}
labels={'en':['Key product facts','What to confirm','Original research summary','Related resources','Home'],'zh-CN':['产品事实速览','需要确认的信息','英文原文研究摘要','相关资料','首页'],'es':['Datos del producto','Qué confirmar','Resumen original en inglés','Recursos relacionados','Inicio'],'fr':['Informations sur le produit','Points à confirmer','Résumé original en anglais','Ressources associées','Accueil'],'de':['Produktinformationen','Was zu bestätigen ist','Englische Studienzusammenfassung','Weitere Informationen','Startseite'],'ja':['製品情報の要点','確認事項','英語の研究概要','関連資料','ホーム'],'ko':['제품 정보 요약','확인할 사항','영문 연구 요약','관련 자료','홈'],'id':['Fakta produk','Hal yang perlu dikonfirmasi','Ringkasan penelitian bahasa Inggris','Sumber terkait','Beranda']}
raw=(DIST/'customer-content.js').read_text();questions=json.loads(raw.split('const customerQuestions=')[1].split(';')[0])
# Existing supplied article facts, not newly asserted medical outcomes.
import subprocess
studies=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm'),c={};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/evidence.js','utf8'),c);console.log(JSON.stringify(vm.runInContext('studies',c)))"],cwd=ROOT,text=True))
def text(el):return ' '.join(el.text_content().split())
def element(tag,s='',**attrs):
 e=etree.Element(tag,**attrs);e.text=s;return e
def setmeta(head,attr,key,value):
 found=head.xpath(f'meta[@{attr}="{key}"]');e=found[0] if found else etree.SubElement(head,'meta',**{attr:key});e.set('content',value)
def routes(file):
 p='/' + file.relative_to(DIST).parent.as_posix().strip('.') .strip('/')+'/'
 p=p.replace('//','/');lang=p.split('/')[1] if p.split('/')[1] in LANGS[1:] else 'en';base=p[len('/'+lang):] if lang!='en' else p
 return p,lang,base
runtime={};inventory=[]
for f in sorted(DIST.rglob('*.html')):
 doc=html.fromstring(f.read_text());head=doc.find('head');main=doc.xpath('//main')[0];route,lang,base=routes(f);t=copy.get(lang,{})
 for e in doc.xpath('//*[@data-seo-geo]'):e.getparent().remove(e)
 for e in head.xpath('script[@type="application/ld+json"]'):head.remove(e)
 canon=doc.xpath('//link[@rel="canonical"]/@href')[0];canonical=urlparse(canon).path;meta=cfg['pages'].get(base);kind=meta['page'] if meta else 'review';h1=text(main.xpath('.//h1')[0]);title=doc.xpath('string(//title)');description=doc.xpath('//meta[@name="description"]/@content')[0]
 prefix='' if lang=='en' else '/'+lang
 if kind=='answer':
  index=next(i for i,q in enumerate(questions) if base.endswith('/'+q['slug']+'/'));q=questions[index];answer=q['answer'] if lang=='en' else t['questions'][index][1];intro=main.xpath('.//section[contains(@class,"page-intro")]//p');answer=text(intro[0]) if intro else answer;description=answer
  if lang=='en':title=q['question']+' | QuickMind'
  # Replace generic translated filler with topic-specific confirmation facts.
  if lang!='en':
   article=main.xpath('.//article[contains(@class,"answer-article")]')[0]
   for e in list(article)[:2]:
    if e.tag=='p':article.remove(e)
   section=element('section',**{'data-seo-geo':'answer-context','class':'geo-facts'});section.append(element('h2',labels[lang][1]))
   related=[i for i,x in enumerate(questions) if x['category']==q['category'] and i!=index][:2]
   if not related:related=[2,19]
   for i in related:
    section.append(element('h3',t['questions'][i][0]));section.append(element('p',t['questions'][i][1]))
   article.insert(0,section)
 elif kind not in ['home','insights','review'] and lang!='en':
  specific={'product':t['intro']+' '+t['training'],'pricing':t['homePurpose']+' '+t['priceNote'],'compare':t['homePurpose']+' '+t['clinicPurpose']+' '+t['distributorPurpose'],'faq':t['allQuestions']+' '+t['questions'][12][0]+' '+t['questions'][15][0],'contact':t['delivery']+' '+t['support'],'evidence':t['researchNote'],'registrations':t['documentsNote'],'scenes':t['internationalNote']}
  description=specific.get(kind,description)
  title=h1+' | QuickMind'
 if kind=='product':
  section=element('section',**{'data-seo-geo':'product-facts','class':'container section geo-facts'});section.append(element('h2',labels[lang][0]))
  for i in [0,2,5]:
   section.append(element('h3',questions[i]['question'] if lang=='en' else t['questions'][i][0]));section.append(element('p',questions[i]['answer'] if lang=='en' else t['questions'][i][1]))
  links=element('p');a=element('a',t.get('faq','All 20 questions'),href=prefix+'/pages/faq/',**{'class':'text-link'});links.append(a);section.append(links);main.append(section)
 if kind=='evidence' and lang!='en':
  for card,s in zip(main.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," study-card ")]'),studies):
   section=element('section',**{'data-seo-geo':'study-summary'});section.append(element('h3',labels[lang][2]));section.append(element('p',s['n']+' · '+s['summary'],lang='en'));section.append(element('p',s['scope']+' '+s['limit'],lang='en'));card.append(section)
 # Use the real answer, remove inflated generic metadata and keep all languages distinct.
 description=' '.join(description.split())
 if len(description)>185:description=description[:182].rsplit(' ',1)[0]+'…' if lang not in ['zh-CN','ja','ko'] else description[:182]+'…'
 head.find('title').text=title;setmeta(head,'name','description',description)
 for k,v in {'og:type':'website','og:site_name':'QuickMind Store1','og:title':title,'og:description':description,'og:url':canon,'og:image':ORIGIN+'/assets/headset.webp','og:image:alt':'QuickMind headset and illustrative reporting screen','og:locale':{'en':'en_US','zh-CN':'zh_CN','es':'es_ES','fr':'fr_FR','de':'de_DE','ja':'ja_JP','ko':'ko_KR','id':'id_ID'}[lang]}.items():setmeta(head,'property',k,v)
 for k,v in {'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,'twitter:image':ORIGIN+'/assets/headset.webp'}.items():setmeta(head,'name',k,v)
 # No Offer, fake reviews, global approval or treatment-efficacy schema.
 org={'@type':'Organization','@id':ORIGIN+'/#organization','name':'YIWEI USA INC','url':ORIGIN+'/','email':'yiweiinc99@gmail.com','address':{'@type':'PostalAddress','streetAddress':'670 Lake Medlock Dr','addressLocality':'Johns Creek','addressRegion':'GA','postalCode':'30022','addressCountry':'US'}}
 site={'@type':'WebSite','@id':ORIGIN+'/#website','name':'QuickMind Store1','url':ORIGIN+'/','inLanguage':LANGS,'publisher':{'@id':org['@id']}}
 web={'@type':'CollectionPage' if kind in ['faq','evidence','registrations','scenes'] else 'ContactPage' if kind=='contact' else 'WebPage','@id':canon+'#webpage','url':canon,'name':title,'description':description,'inLanguage':lang,'isPartOf':{'@id':site['@id']}}
 crumb={'@type':'BreadcrumbList','@id':canon+'#breadcrumb','itemListElement':[{'@type':'ListItem','position':1,'name':labels[lang][4],'item':ORIGIN+prefix+'/'}]}
 if canonical!=prefix+'/':crumb['itemListElement'].append({'@type':'ListItem','position':2,'name':h1,'item':canon})
 web['breadcrumb']={'@id':crumb['@id']};graph=[org,site,web,crumb]
 if kind=='product':
  product={'@type':'Product','@id':ORIGIN+prefix+'/home-product/#product','name':'QuickMind Home VR training system','description':questions[0]['answer'] if lang=='en' else t['questions'][0][1],'category':'VR cognitive training','image':ORIGIN+'/assets/headset.webp','brand':{'@type':'Brand','name':'QuickMind'},'url':ORIGIN+prefix+'/home-product/'};graph.append(product);web['mainEntity']={'@id':product['@id']}
 if kind=='answer':web['mainEntity']={'@type':'Question','name':questions[index]['question'] if lang=='en' else t['questions'][index][0],'acceptedAnswer':{'@type':'Answer','text':answer}}
 if kind=='faq':
  items=[]
  for i,q in enumerate(questions):items.append({'@type':'Question','name':q['question'] if lang=='en' else t['questions'][i][0],'acceptedAnswer':{'@type':'Answer','text':q['answer'] if lang=='en' else t['questions'][i][1]},'url':ORIGIN+prefix+'/pages/answers/'+q['slug']+'/'})
  # Currency-bearing localized copy must match the actual rendered answer.
  visible=main.xpath('.//details')
  for item,detail in zip(items,visible):
   p=detail.xpath('./p');item['acceptedAnswer']['text']=text(p[0]) if p else item['acceptedAnswer']['text']
  web['mainEntity']=items
 if kind=='evidence':
  items=[]
  for i,s in enumerate(studies):
   article={'@type':'ScholarlyArticle','@id':'https://doi.org/'+s['doi'],'name':s['title'],'url':'https://doi.org/'+s['doi'],'identifier':s['doi'],'encoding':{'@type':'MediaObject','contentUrl':ORIGIN+'/documents/'+s['file']+'.pdf','encodingFormat':'application/pdf'}}
   graph.append(article);items.append({'@type':'ListItem','position':i+1,'item':{'@id':article['@id']}})
  web['mainEntity']={'@type':'ItemList','itemListElement':items}
 data={'@context':'https://schema.org','@graph':graph};script=element('script',json.dumps(data,ensure_ascii=False).replace('<','\\u003c'),type='application/ld+json',id='site-structured-data');head.append(script)
 # Visible breadcrumbs for pages that lacked them; a named landmark separates them from menus.
 if canonical!=prefix+'/' and not main.xpath('.//nav[@aria-label="Breadcrumb"]'):
  nav=element('nav',**{'data-seo-geo':'breadcrumb','class':'container seo-breadcrumb','aria-label':'Breadcrumb'});nav.append(element('a',labels[lang][4],href=prefix+'/'));nav[-1].tail=' / '+h1;main.insert(0,nav)
 for img in main.xpath('.//img'):
  if img.get('fetchpriority')!='high':img.set('loading','lazy')
  img.set('decoding','async')
 # Runtime English SPA must apply this page's complete graph after navigation.
 if lang=='en' and meta:
  runtime[base]={'title':title,'description':description,'canonical':meta['canonical'],'graph':data,'fragment':html.tostring(section,encoding='unicode') if kind=='product' else ''}
  for e in doc.xpath('//script[@src="/seo-geo-data.js"]'):e.getparent().remove(e)
  seo=doc.xpath('//script[@src="/seo.js"]')[0];seo.addprevious(element('script',src='/seo-geo-data.js',defer='defer'))
 # Private review/simulation/metrics pages remain non-indexable even at launch.
 setmeta(head,'name','robots','noindex,follow' if cfg['private'] or kind in ['review','insights'] else 'index,follow,max-image-preview:large')
 f.write_text('<!doctype html>\n'+html.tostring(doc,encoding='unicode',method='html'))
 inventory.append({'route':route,'kind':kind,'language':lang,'title':title,'description':description,'canonical':canon,'mainCharacters':len(text(main))})
(DIST/'seo-geo-data.js').write_text('const qmSeoGeoPages='+json.dumps(runtime,ensure_ascii=False).replace('<','\\u003c')+';\n')
(ROOT/'seo-geo-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2))
# Launch-only sitemap inventory: excludes aliases and internal review/simulation pages.
launch=[r['canonical'] for r in inventory if r['kind'] not in ['review','insights'] and ORIGIN+r['route']==r['canonical']]
(ROOT/'sitemap-launch.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+u+'</loc></url>' for u in sorted(set(launch)))+'</urlset>')
print(json.dumps({'pages':len(inventory),'runtimeRoutes':len(runtime),'launchCanonicalPages':len(set(launch))}))
