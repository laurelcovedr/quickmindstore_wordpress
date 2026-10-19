// Shared by English SPA and seven localized static pages. No PII in browser storage.
const copy={
 en:['Submit inquiry','I agree to use my contact details to respond to this inquiry. Please do not include medical records.','Submitting…','Inquiry received. Reference: ','Submission could not be confirmed. Your entries are retained; retry or contact us by email.','Allow anonymous page and inquiry-click measurement (optional).'],
 'zh-CN':['提交询盘','我同意使用联系信息回复此次询盘。请勿填写病历或敏感健康信息。','正在提交…','询盘已收到，编号：','无法确认提交成功。已保留填写内容，请重试或通过邮件联系。','允许匿名页面及询盘点击统计（可选）。'],
 es:['Enviar consulta','Acepto el uso de mis datos para responder. No incluya historias clínicas.','Enviando…','Consulta recibida. Referencia: ','No se pudo confirmar el envío. Sus datos permanecen; reintente o envíe un correo.','Permitir métricas anónimas de páginas y clics (opcional).'],
 fr:['Envoyer la demande','J’accepte l’utilisation de mes coordonnées pour répondre. Ne joignez pas de dossier médical.','Envoi…','Demande reçue. Référence : ','Envoi non confirmé. Vos saisies sont conservées ; réessayez ou contactez-nous par e-mail.','Autoriser les mesures anonymes des pages et clics (facultatif).'],
 de:['Anfrage senden','Ich stimme der Nutzung meiner Kontaktdaten zur Antwort zu. Keine Krankenakten angeben.','Wird gesendet…','Anfrage erhalten. Referenz: ','Versand nicht bestätigt. Eingaben bleiben erhalten; erneut versuchen oder E-Mail senden.','Anonyme Seiten- und Klickmessung erlauben (optional).'],
 ja:['問い合わせを送信','返信のための連絡先利用に同意します。診療記録は入力しないでください。','送信中…','問い合わせを受け付けました。番号：','送信を確認できません。入力は保持されています。再試行またはメールでご連絡ください。','匿名のページ・クリック計測を許可（任意）。'],
 ko:['문의 제출','답변을 위한 연락처 사용에 동의합니다. 의료 기록은 입력하지 마세요.','제출 중…','문의가 접수되었습니다. 번호: ','제출을 확인할 수 없습니다. 입력은 유지됩니다. 다시 시도하거나 이메일로 문의하세요.','익명 페이지 및 클릭 측정 허용 (선택).'],
 id:['Kirim pertanyaan','Saya menyetujui penggunaan kontak untuk membalas. Jangan sertakan rekam medis.','Mengirim…','Pertanyaan diterima. Referensi: ','Pengiriman belum terkonfirmasi. Isian tetap tersedia; coba lagi atau hubungi melalui email.','Izinkan pengukuran halaman dan klik anonim (opsional).']};
const forms='[data-quote-form],[data-locale-quote]',state=new WeakMap();
function language(){return copy[document.documentElement.lang]?document.documentElement.lang:'en'}
function endpoint(){return window.QM_LEAD_API||'/lead-api'}
export function prepare(form){if(state.has(form))return;const t=copy[language()];state.set(form,{id:crypto.randomUUID(),busy:false});
 const box=document.createElement('div');box.innerHTML=`<label><input type="checkbox" name="lead_consent" required> ${t[1]}</label><label style="display:block"><input type="checkbox" name="analytics_consent"> ${t[5]}</label><label hidden aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><p data-lead-status role="status" aria-live="polite"></p>`;
 form.append(box);const b=form.querySelector('[type=submit]');if(b){b.textContent=t[0];b.disabled=false}}
export async function submit(form){prepare(form);const s=state.get(form),t=copy[language()];if(s.busy||!form.reportValidity())return;
 const d=new FormData(form),at=typeof inquiryAttribution==='function'?inquiryAttribution():{page:location.pathname,cta:'direct-form',reference:'',utm:{}};
 const buyer=d.get('buyer');const selected=form.querySelector('[name=buyer]');const type=(['home','clinic','distributor'].includes(buyer)&&buyer)||(selected&&['home','clinic','distributor'][selected.selectedIndex])||{'Home user / caregiver':'home','Clinic / care organization':'clinic','Distributor / commercial partner':'distributor'}[buyer]||'home';
 let utm=at.utm;try{if(d.get('source_campaign'))utm=JSON.parse(d.get('source_campaign'))}catch{}
 const payload={submission_id:s.id,customer_type:type,language:language(),consent:d.get('lead_consent')==='on',website:d.get('website')||'',source_page:d.get('source_page')||at.page,source_cta:d.get('source_cta')||at.cta,source_reference:d.get('source_reference')||at.reference,utm};
 for(const k of ['name','email','country','organization','quantity','payment','notes'])payload[k]=d.get(k)||'';
 const fingerprint=JSON.stringify({...payload,submission_id:null});if(s.last&&s.last!==fingerprint)s.id=crypto.randomUUID();payload.submission_id=s.id;s.last=fingerprint;
 const b=form.querySelector('[type=submit]'),status=form.querySelector('[data-lead-status]');s.busy=true;if(b)b.disabled=true;status.textContent=t[2];
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch((window.QM_LEAD_ENDPOINT||endpoint()+'/v1/leads'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,credentials:'omit'});const result=await r.json();if(!r.ok||result.ok!==true||result.stored!==true||!result.lead_id)throw Error('unconfirmed');status.textContent=t[3]+result.lead_id;
 if(typeof addMetric==='function')addMetric(payload.source_page,'acceptedLeads');
 if(d.get('analytics_consent')==='on'&&navigator.doNotTrack!=='1'&&navigator.globalPrivacyControl!==true){window.qmAnalyticsConsent=true;event('page_view');}
 }catch{status.textContent=t[4]}finally{clearTimeout(timer);s.busy=false;if(b)b.disabled=false}}
function event(kind,cta=''){if(window.QM_LEAD_ENDPOINT)return;if(window.qmAnalyticsConsent!==true||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;fetch(endpoint()+'/v1/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),consent:true,event:kind,source_page:location.pathname,source_cta:cta,language:language()}),credentials:'omit'}).catch(()=>{})}
window.qmMeasurePage=()=>event('page_view');
window.qmSetAnalyticsConsent=value=>{window.qmAnalyticsConsent=value===true;if(value===true)event('page_view')};
function scan(){document.querySelectorAll(forms).forEach(prepare)}
scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{const el=e.target.closest('[data-action],a[data-route]');if(el&&(['inquiry','clinic','distributor','support'].includes(el.dataset.action)||el.href?.includes('/pages/contact/')))event('inquiry_click',el.dataset.source||'direct-form')},true);
export {copy};
