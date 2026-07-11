import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
await p.goto('http://localhost:5173/relatorios',{waitUntil:'networkidle2'});
await new Promise(x=>setTimeout(x,1200));
console.log('relatorios h1:', await p.evaluate(()=>document.querySelector('main h1,div h1')?.textContent));
console.log('botoes:', await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>['Compacto','Visualizar','Enviar','PDF','Excel'].some(x=>t.includes(x)))));
// pagina publica inexistente -> deve mostrar 'nao encontrado', sem crash
await p.goto('http://localhost:5173/r/xyztest',{waitUntil:'networkidle2'});
await new Promise(x=>setTimeout(x,1200));
console.log('publica h1:', await p.evaluate(()=>document.querySelector('h1')?.textContent));
console.log('erros:', errs.length?errs.slice(0,6).join(' | '):'NENHUM');
await b.close();
