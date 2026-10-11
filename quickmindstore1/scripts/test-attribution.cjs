const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data={},handlers={};const storage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]};
const ctx={location:{pathname:'/pages/answers/first-year-price/',search:'?utm_source=linkedin&utm_campaign=october-global',origin:'https://test.local'},URL,URLSearchParams,Date,sessionStorage:storage,localStorage:storage,navigator:{doNotTrack:'0'},document:{hidden:false,documentElement:{scrollHeight:2000},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>handlers[name]=fn},window:{innerHeight:800,scrollY:0,addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/tracking.js','utf8'),ctx);
const button={dataset:{action:'inquiry',source:'QM-ANSWER-PRICE-inquiry-2'},matches:()=>false};handlers.click({target:{closest:()=>button}});
const result=vm.runInContext('inquiryAttribution()',ctx);assert.equal(result.page,'/pages/answers/first-year-price/');assert.equal(result.cta,'QM-ANSWER-PRICE-inquiry-2');assert.equal(result.utm.utm_source,'linkedin');assert.equal(result.utm.utm_campaign,'october-global');
vm.runInContext('measurePage();flushActive()',ctx);const stats=JSON.parse(data['qm-engagement-v1']);assert.equal(stats[result.page].inquiryClicks,1);assert.equal(stats[result.page].views,1);assert.ok(!data['qm-engagement-v1'].includes('linkedin'));assert.ok(!data['qm-engagement-v1'].includes('@'));assert.ok(!Object.keys(stats[result.page]).some(k=>['name','email','notes','campaign'].includes(k)));
console.log('Page/CTA/UTM attribution and isolated anonymous browser counts passed.');

// A new campaign must not inherit fields from the previous campaign.
const second={...ctx,location:{...ctx.location,search:'?utm_source=google'},document:{...ctx.document,addEventListener(){}}};vm.createContext(second);vm.runInContext(fs.readFileSync('dist/tracking.js','utf8'),second);const next=vm.runInContext('inquiryAttribution()',second);assert.equal(next.utm.utm_source,'google');assert.equal(next.utm.utm_campaign,undefined);
vm.runInContext("addMetric('/products/quickmind-home/','views')",second);assert.ok(JSON.parse(data['qm-engagement-v1'])['/home-product/']);

// Non-Latin labels, repeated CTA placement and editorial keys must stay distinct and stable.
const elements=['了解产品','产品','联系我们'].map((text,i)=>({textContent:text,dataset:i===2?{source:'QM1-zh-CN-path-clinic'}:{},href:i===2?'/zh-CN/pages/contact/?intent=clinic':'/zh-CN/home-product/',matches:()=>true,getAttribute(){return this.href},setAttribute(k,v){this[k]=v}}));
const mails=[{id:'local-mail',href:'mailto:yiweiinc99@gmail.com?body=Prepared%20customer%20request',setAttribute(k,v){this[k]=v}},{id:'send-email',href:'mailto:yiweiinc99@gmail.com?body=Other%20prepared%20request',setAttribute(k,v){this[k]=v}},{id:'footer-email',setAttribute(k,v){this[k]=v}}];
ctx.document.querySelectorAll=q=>q.startsWith('a[href')?mails:elements;
ctx.location.pathname='/zh-CN/';vm.runInContext('tagPageSources()',ctx);
const keys=elements.map(e=>e.dataset.source),hrefs=elements.map(e=>e.href);assert.equal(new Set(keys).size,3);assert.ok(keys[2].includes('qm1-zh-cn-path-clinic'));assert.equal(new URL(elements[2].href,ctx.location.origin).searchParams.get('intent'),'clinic');
vm.runInContext('tagPageSources()',ctx);assert.deepEqual(elements.map(e=>e.dataset.source),keys);assert.deepEqual(elements.map(e=>e.href),hrefs);assert.ok(mails[0].href.includes('Prepared%20customer'));assert.ok(mails[1].href.includes('Other%20prepared'));assert.ok(mails[2].href.includes('Source%20page'));
console.log('Multilingual source keys are unique, preserve intent, survive retagging and protect prepared email drafts.');
