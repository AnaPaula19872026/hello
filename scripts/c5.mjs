import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
for(const r of ['/','/chamadas','/relatorios']){
  await p.goto('http://localhost:5173'+r,{waitUntil:'networkidle2'});
  await new Promise(x=>setTimeout(x,1300));
  console.log(r,'->',await p.evaluate(()=>document.querySelector('main h1')?.textContent));
}
console.log('erros:', errs.length?errs.slice(0,6).join(' | '):'NENHUM');
await b.close();
