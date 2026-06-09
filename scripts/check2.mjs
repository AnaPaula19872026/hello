import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
for(const route of ['/escolas','/relatorios']){
  await p.goto('http://localhost:5173'+route,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,1200));
  const h1=await p.evaluate(()=>document.querySelector('h1')?.textContent);
  console.log(route,'-> H1:',h1);
}
console.log('erros:', errs.length?errs.slice(0,5).join(' | '):'NENHUM');
await b.close();
