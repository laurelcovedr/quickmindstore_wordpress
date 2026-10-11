/* Browser execution only. Fixtures are labelled; no checkout or email is sent. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../dist'),out=path.resolve(process.env.QA_OUTPUT||'browser-qa-artifacts');
const languages=['en','zh-CN','es','fr','de','ja','ko','id'];
const sizes={phone:{width:390,height:844},tablet:{width:768,height:1024},desktop:{width:1440,height:900}};
const results={started:new Date().toISOString(),browser_qa:false,real_payment_test:false,cases:[],scope:'Chromium viewport emulation; not physical devices or Safari. Geo/PayPal fixtures are not live validation.'};
fs.mkdirSync(out,{recursive:true});
let server,browser,base=process.env.QA_BASE_URL;
async function caseRun(name,fn){try{await fn();results.cases.push({name,status:'passed'})}catch(e){results.cases.push({name,status:'failed',error:e.message});console.error(name,e.message)}}
async function context(viewport,{country='US',geoFailure=false,paypal='blocked',prefs}={}){
 const headers={};if(process.env.QA_SITE_TOKEN&&base.startsWith('https://quickmind-store1.lawrence-wan-0405.chatgpt.site'))headers['OAI-Sites-Authorization']=process.env.QA_SITE_TOKEN;
 const c=await browser.newContext({viewport,locale:'en-US'});
 // Send private-preview credentials only to this exact origin, never third-party requests.
 if(Object.keys(headers).length)await c.route('https://quickmind-store1.lawrence-wan-0405.chatgpt.site/**',r=>r.continue({headers:{...r.request().headers(),...headers}}));
 if(process.env.QA_LIVE!=='1')await c.route('https://ipapi.co/**',r=>geoFailure?r.abort():r.fulfill({json:{country_code:country}}));
 if(process.env.QA_LIVE!=='1')await c.route('https://www.paypal.com/sdk/js**',r=>paypal==='blocked'?r.abort():r.fulfill({contentType:'application/javascript',body:'window.paypal={HostedButtons:()=>({render:async selector=>{document.querySelector(selector).innerHTML="<button data-test-paypal>PayPal fixture — no payment</button>"}})}'}));
 if(prefs)await c.addInitScript(p=>{if(!localStorage.getItem('qm-preferences-v1'))localStorage.setItem('qm-preferences-v1',JSON.stringify(p))},prefs);
 return c;
}
async function ready(p,url){const r=await p.goto(base+url,{waitUntil:'domcontentloaded'});assert(r.ok(),`HTTP ${r.status()}`);await p.locator('#app h1').waitFor();}
async function snapshot(p,name){for(const img of await p.locator('img').all()){if(await img.isVisible()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>Promise.race([el.decode().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]));}}await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function form(p,lang){const f=p.locator(lang==='en'?'[data-quote-form]':'[data-locale-quote]');await f.waitFor();await f.locator('[type=submit]').click();assert.equal(await f.evaluate(el=>el.checkValidity()),false,'Empty required fields must be invalid');await f.locator('[name=name]').fill('QA Example');await f.locator('[name=email]').fill('qa@example.invalid');await f.locator('[name=country]').fill('Japan');await f.locator('[name=quantity]').fill('2');await f.locator('[type=submit]').click();const text=p.locator(lang==='en'?'#request-preview':'#local-request');await text.waitFor({state:'visible'});assert.match(await text.inputValue(),/QA Example/);assert.match(await text.inputValue(),/qa@example.invalid/);assert.match(await text.inputValue(),/browser-qa/);const mail=p.locator(lang==='en'?'#send-email':'#local-mail');assert.match(await mail.getAttribute('href'),/^mailto:yiweiinc99@gmail.com\?/);}
(async()=>{
 try{
  if(!base){server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root)throw Error();if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end('Not found')}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
  results.baseURL=base;results.fixtureMode=process.env.QA_LIVE!=='1';
  browser=await chromium.launch({headless:true});results.browserVersion=browser.version();
  for(const [device,viewport]of Object.entries(sizes))for(const lang of languages)await caseRun(`${device}/${lang}/layout-navigation-faq-form`,async()=>{
   const c=await context(viewport);const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{const prefix=lang==='en'?'':'/'+lang;
    for(const route of ['/','/home-product/','/pricing/','/pages/faq/','/pages/contact/']){
     await ready(p,prefix+route+'?utm_source=browser-qa');assert.equal(await p.locator('html').getAttribute('lang'),lang);assert.match(await p.locator('meta[name=robots]').getAttribute('content'),/noindex/);
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');assert.equal(await p.locator('header nav a').count(),6);
     if(route==='/'){await snapshot(p,`${device}-${lang}-home`);const menu=p.locator('.menu-toggle');if(await menu.isVisible()){await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');await p.locator('header nav a').nth(1).click();assert.equal(await menu.getAttribute('aria-expanded'),'false','Menu must close after navigation');}}
     if(route==='/home-product/'){if(lang==='en')assert(await p.locator('[data-action=paypal]').count()>0,'Payment entry absent');else {const entry=p.locator('#app a[href="/'+lang+'/pages/contact/"]').first();assert(await entry.isVisible(),'Visible quotation entry absent');assert.match(await entry.getAttribute('data-source'),/./);}await snapshot(p,`${device}-${lang}-product`);}
     if(route==='/pricing/'&&lang!=='en'){await p.locator('[data-paypal-hosted]').waitFor();await p.waitForFunction(()=>['error','ready'].includes(document.querySelector('[data-paypal-hosted]')?.dataset.paypalState));}
     if(route==='/pages/faq/'){const first=p.locator('details').first();await first.locator('summary').click();assert.equal(await first.getAttribute('open'),'');await first.locator('summary').press('Enter');assert.equal(await first.getAttribute('open'),null);}
     if(route==='/pages/contact/'){await form(p,lang);await snapshot(p,`${device}-${lang}-quote`);}
    }
    assert.deepEqual(errors,[],'Uncaught page errors');
   }finally{await c.close()}
  });
  await caseRun('eight-language-switch-preserves-query-hash',async()=>{const c=await context(sizes.desktop);try{const p=await c.newPage();await ready(p,'/pricing/?utm_source=browser-qa#plans');for(const lang of languages){await Promise.all([p.waitForURL(u=>u.pathname===(lang==='en'?'':'/'+lang)+'/pricing/'),p.locator('[data-language-select]').selectOption(lang)]);assert.equal(await p.locator('html').getAttribute('lang'),lang);assert.match(p.url(),/utm_source=browser-qa#plans/);}}finally{await c.close()}});
  if(process.env.QA_LIVE!=='1'){
   for(const [country,lang,currency]of [['US','en','USD'],['CN','zh-CN','CNY'],['ES','es','EUR'],['FR','fr','EUR'],['DE','de','EUR'],['JP','ja','JPY'],['KR','ko','KRW'],['ID','id','IDR']])await caseRun(`geo-fixture/${country}`,async()=>{const c=await context(sizes.desktop,{country});try{const p=await c.newPage();await ready(p,'/pricing/?utm_source=browser-qa');await p.waitForFunction(l=>document.documentElement.lang===l,lang);await p.waitForFunction(cur=>document.querySelector('[data-currency-select]').value===cur,currency);assert.match(p.url(),/utm_source=browser-qa/);}finally{await c.close()}});
   await caseRun('manual-language-currency-override-survives-new-IP',async()=>{const c=await context(sizes.desktop,{country:'JP',prefs:{language:'de',currency:'GBP',manualLanguage:true,manualCurrency:true}});try{const p=await c.newPage();await ready(p,'/pricing/');await p.waitForURL('**/de/pricing/');assert.equal(await p.locator('[data-currency-select]').inputValue(),'GBP');await p.locator('[data-currency-select]').selectOption('CAD');await p.reload();assert.equal(await p.locator('[data-currency-select]').inputValue(),'CAD');}finally{await c.close()}});
   await caseRun('geo-network-failure-fallback',async()=>{const c=await context(sizes.phone,{geoFailure:true});try{const p=await c.newPage();await ready(p,'/pricing/');assert.equal(await p.locator('html').getAttribute('lang'),'en');assert.equal(await p.locator('[data-currency-select]').inputValue(),'USD');}finally{await c.close()}});
   for(const mode of ['blocked','fixture'])await caseRun(`paypal-${mode}-not-real-payment`,async()=>{const c=await context(sizes.desktop,{paypal:mode});try{const p=await c.newPage();await ready(p,'/');await p.locator('footer [data-action=paypal]').click();const target=p.locator('[data-paypal-hosted]');await p.waitForFunction(s=>document.querySelector('[data-paypal-hosted]')?.dataset.paypalState===s,mode==='blocked'?'error':'ready');if(mode==='blocked'){await target.locator('[data-paypal-retry]').click();await p.waitForFunction(()=>document.querySelector('[data-paypal-hosted]')?.dataset.paypalState==='error');}await snapshot(p,'paypal-'+mode);if(mode==='fixture')assert.match(await p.locator('#quickmind-paypal-sdk').getAttribute('src'),/currency=USD/);}finally{await c.close()}});
  }else await caseRun('live-paypal-SDK-render-only',async()=>{const c=await context(sizes.desktop);try{const p=await c.newPage();await ready(p,'/');await p.locator('footer [data-action=paypal]').click();await p.waitForFunction(()=>document.querySelector('[data-paypal-hosted]')?.dataset.paypalState==='ready',{},{timeout:30000});assert(await p.locator('[data-paypal-hosted] iframe').count()>0,'Expected real hosted iframe');await snapshot(p,'live-paypal-render');}finally{await c.close()}});
  results.browser_qa=results.cases.every(c=>c.status==='passed');
 }catch(e){results.blocker=e.message;console.error(e.message)}finally{results.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));}
 console.log(JSON.stringify({passed:results.cases.filter(c=>c.status==='passed').length,failed:results.cases.filter(c=>c.status==='failed').length,blocker:results.blocker}));process.exitCode=results.browser_qa?0:1;
})();
