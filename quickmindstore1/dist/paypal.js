const paypalSdkUrl='https://www.paypal.com/sdk/js?client-id=BAAoLz38ZtN18icDU9woa3UrycFHVH2OQb6UJedjgg80KXeZ0DAZK7K0giVgP1wcjWP0BjmCFsrorGGJsw&components=hosted-buttons&enable-funding=venmo&currency=USD';
let paypalSdkPromise=null;
function loadPayPalSdk(){
 if(window.paypal?.HostedButtons)return Promise.resolve(window.paypal);
 if(paypalSdkPromise)return paypalSdkPromise;
 paypalSdkPromise=new Promise((resolve,reject)=>{
  document.querySelector('#quickmind-paypal-sdk')?.remove();
  const script=document.createElement('script');script.id='quickmind-paypal-sdk';script.src=paypalSdkUrl;script.async=true;
  script.onload=()=>{if(window.paypal?.HostedButtons)resolve(window.paypal);else{script.remove();reject(new Error('PayPal component unavailable'))}};
  script.onerror=()=>{script.remove();reject(new Error('PayPal SDK could not load'))};document.head.appendChild(script);
 });
 paypalSdkPromise.catch(()=>{paypalSdkPromise=null});return paypalSdkPromise;
}
async function mountPayPalButtons(){
 const targets=[...document.querySelectorAll('[data-paypal-hosted]')].filter(el=>!el.dataset.paypalState);
 if(!targets.length)return;
 targets.forEach(el=>el.dataset.paypalState='loading');
 let timer;
 try{
  const sdk=await Promise.race([loadPayPalSdk(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PayPal loading timed out')),15000)})]);clearTimeout(timer);
  await Promise.all(targets.map(async el=>{
   if(!el.isConnected)return;
   try{el.replaceChildren();await sdk.HostedButtons({hostedButtonId:'Q948BV8DXQXWG'}).render('#'+el.id);el.dataset.paypalState='ready'}catch{showPayPalError(el)}
  }));
 }catch{clearTimeout(timer);targets.forEach(showPayPalError)}
}
function showPayPalError(el){if(!el.isConnected)return;el.dataset.paypalState='error';const copy=JSON.parse(document.querySelector('#localized-copy')?.textContent||'{}');el.replaceChildren();const message=document.createElement('p');message.className='payment-caption';message.setAttribute('role','status');message.textContent=copy.paymentError||'PayPal could not load. Please retry or contact the sales team.';const button=document.createElement('button');button.type='button';button.className='btn outline';button.dataset.paypalRetry='';button.textContent=copy.paymentRetry||'Retry PayPal';el.append(message,button)}
document.addEventListener('click',e=>{const retry=e.target.closest('[data-paypal-retry]');if(retry){const container=retry.closest('[data-paypal-hosted]');delete container.dataset.paypalState;if(!window.paypal?.HostedButtons)paypalSdkPromise=null;container.innerHTML='<p class="payment-caption" role="status">Loading PayPal payment options…</p>';mountPayPalButtons()}});
