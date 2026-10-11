const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');const config=JSON.parse(fs.readFileSync(path.join(root,'seo-config.json'),'utf8'));
const nodes=new Map();function get(q){if(!nodes.has(q))nodes.set(q,{innerHTML:'',textContent:'',value:'',classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(){}});return nodes.get(q)}
const c={document:{querySelector:get,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener(){}},location:{pathname:'/',origin:config.origin},window:{scrollTo(){},addEventListener(){}},updateSeoMetadata(){},mountPayPalButtons(){},tagPageSources(){},inquiryAttribution(){return {page:c.location.pathname,cta:'direct-contact',reference:'QM-PREVIEW',utm:{}}},localInsights(){return {}},siteSeo:config,encodeURIComponent,sourceReference(){return 'QM-'+(c.location.pathname==='/'?'HOME':c.location.pathname.replace(/^\/|\/$/g,'').replace(/[^a-z0-9]+/gi,'-').toUpperCase())}};
vm.createContext(c);for(const name of ['store1-content.js','evidence.js','extensions.js','scenarios.js','customer-content.js','app.js'])vm.runInContext(fs.readFileSync(path.join(dist,name),'utf8'),c);
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [route,m] of Object.entries(config.pages)){
 c.location.pathname=route;vm.runInContext('render(false)',c);let content=get('#app').innerHTML;
 content=content.replace('<button class="btn" type="submit">Prepare My Quote Request</button>','<button class="btn" type="submit" disabled>Enable JavaScript to Prepare a Request</button>');
 content+='<noscript><div class="container notice">The product information is available without JavaScript. For quotations or payment assistance, email <a href="mailto:yiweiinc99@gmail.com">yiweiinc99@gmail.com</a>. Enable JavaScript for forms and PayPal checkout.</div></noscript>'; 
 const file=path.join(dist,route,'index.html');let html=fs.readFileSync(file,'utf8');
 const url=config.origin+m.canonical;
 const crumbs=[{'@type':'ListItem',position:1,name:'Home',item:config.origin+'/'}];if(m.canonical!=='/')crumbs.push({'@type':'ListItem',position:2,name:m.name,item:url});
 const graph={'@context':'https://schema.org','@graph':[
 {'@type':'Organization','@id':config.origin+'/#organization',name:'YIWEI USA INC',url:config.origin+'/',email:'yiweiinc99@gmail.com',address:{'@type':'PostalAddress',streetAddress:'670 Lake Medlock Dr',addressLocality:'Johns Creek',addressRegion:'GA',postalCode:'30022',addressCountry:'US'}},
 {'@type':'WebSite','@id':config.origin+'/#website',name:'QuickMind Store1',url:config.origin+'/',inLanguage:'en',publisher:{'@id':config.origin+'/#organization'}},
 {'@type':'WebPage','@id':url+'#webpage',url,name:m.title,description:m.description,inLanguage:'en',isPartOf:{'@id':config.origin+'/#website'},breadcrumb:{'@id':url+'#breadcrumb'}},
 {'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:crumbs}]};
 const head=`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(m.title)}</title><meta name="description" content="${escape(m.description)}"><meta name="robots" content="${config.private?'noindex,follow':'index,follow,max-image-preview:large'}"><link rel="canonical" href="${escape(url)}"><meta property="og:type" content="website"><meta property="og:site_name" content="QuickMind Store"><meta property="og:title" content="${escape(m.title)}"><meta property="og:description" content="${escape(m.description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${config.origin}/assets/headset.webp"><meta property="og:image:alt" content="QuickMind VR headset and illustrative reporting screen"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(m.title)}"><meta name="twitter:description" content="${escape(m.description)}"><meta name="twitter:image" content="${config.origin}/assets/headset.webp"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><script type="application/ld+json" id="site-structured-data">${JSON.stringify(graph).replace(/</g,'\\u003c')}</script>`;
 html=html.replace(/<head>[\s\S]*?<\/head>/,`<head>${head}</head>`).replace(/<main id="app"[^>]*>[\s\S]*?<\/main>/,`<main id="app" tabindex="-1">${content}</main>`);
 html=html.replace(/<body(?: class="[^"]*")?>/,`<body${m.page==='product'?' class="has-sticky"':''}>`);
 let sourceIndex=0;const ref='QM-'+(route==='/'?'HOME':route.replace(/^\/|\/$/g,'').replace(/[^a-z0-9]+/gi,'-').toUpperCase());html=html.replace(/<(button|a)\b([^>]*)>/g,(all,tag,attrs)=>{if(!/data-action|data-route/.test(attrs))return all;const action=(attrs.match(/data-action="([^"]+)"/)||[])[1]||'link';return '<'+tag+attrs.replace(/ data-source="[^"]*"/g,'')+' data-source="'+ref+'-'+action+'-'+(++sourceIndex)+'">'});fs.writeFileSync(file,html);
}
const canonical=Object.entries(config.pages).filter(([route,m])=>route===m.canonical);
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+canonical.map(([route])=>`<url><loc>${config.origin}${route}</loc></url>`).join('')+'</urlset>\n';
// Private preview stays out of the live sitemap; retain the canonical inventory for launch.
fs.writeFileSync(path.join(root,'sitemap-launch.xml'),sitemap);
fs.writeFileSync(path.join(dist,'sitemap.xml'),config.private?'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n':sitemap);
fs.writeFileSync(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /documents/\nSitemap: ${config.origin}/sitemap.xml\n`);
console.log('Prerendered '+Object.keys(config.pages).length+' HTML routes; private noindex preserved.');
