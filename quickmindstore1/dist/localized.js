const leadModule=import('/lead-client.js');
const localizedCopy=JSON.parse(document.querySelector('#localized-copy').textContent);
const localForm=document.querySelector('[data-locale-quote]');
if(localForm){const intent=new URLSearchParams(location.search).get('intent');if(['home','clinic','distributor'].includes(intent))localForm.querySelector('[name=buyer]').selectedIndex=['home','clinic','distributor'].indexOf(intent);localForm.addEventListener('submit',async e=>{e.preventDefault();try{await (await leadModule).submit(localForm)}catch{document.querySelector('#local-status').textContent='Service unavailable: yiweiinc99@gmail.com';document.querySelector('#local-result').hidden=false}})}
document.querySelector('.menu-toggle').addEventListener('click',e=>{const open=document.querySelector('header nav').classList.toggle('open');e.target.setAttribute('aria-expanded',String(open))});
tagPageSources();mountPayPalButtons();updateLanguageLinks();

