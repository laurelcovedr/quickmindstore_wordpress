const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:8080');
 await page.setContent('<html lang="es"><body><form data-locale-quote><input name="name" value="Browser fixture"><input name="email" value="browser@example.com"><input name="country" value="Brazil"><input name="quantity" value="1"><select name="buyer"><option>Familia</option><option selected>Clínica</option><option>Distribuidor</option></select><button type="submit">Submit</button></form></body></html>');
 await page.evaluate(()=>window.QM_LEAD_ENDPOINT=location.origin+'/wp-json/quickmind/v1/leads');
 await page.addScriptTag({type:'module',content:fs.readFileSync('quickmindstore1/wordpress/quickmind-leads/assets/lead-client.js','utf8')+'\ndocument.querySelector("form").addEventListener("submit",e=>{e.preventDefault();submit(e.target)});'});
 await page.locator('[name=lead_consent]').check();let fail=true;
 await page.route('**/quickmind/v1/leads',r=>fail?r.abort():r.continue());
 await page.locator('button').click();await page.waitForFunction(()=>document.querySelector('[data-lead-status]').textContent.includes('No se pudo'));
 assert.equal(await page.locator('[name=name]').inputValue(),'Browser fixture');fail=false;
 async function send(){const response=page.waitForResponse(r=>r.url().includes('/quickmind/v1/leads'));await page.locator('button').click();return await response;}
 const a=await send(),data=await a.json();assert.equal(a.status(),201);assert.equal(data.stored,true);
 const b=await send();assert.equal(b.status(),200);assert.equal((await b.json()).lead_id,data.lead_id);
 await page.screenshot({path:'wordpress-browser.png'});await browser.close();console.log('Browser network failure, retained fields, real REST persistence and idempotent retry passed');
})().catch(e=>{console.error(e);process.exit(1)});
