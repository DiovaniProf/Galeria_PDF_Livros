/* Biblioteca Digital Imersiva V5.1 — cópias independentes e portfólios */
'use strict';
(() => {
 const dlg=$('copiesDialog'), status=$('copiesStatus'), go=$('copiesGenerate');
 const filename=s=>String(s||'livro').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,80);
 const cleanText=s=>String(s||'').replace(/[\r\t]+/g,' ').replace(/[\u0000-\u001f]/g,' ').trim();
 const notes=()=>[...(reading.record?.entries||[])].sort((a,b)=>a.page-b.page||String(a.date||'').localeCompare(String(b.date||'')));
 const marks=()=>[...(reading.record?.marks||[])].sort((a,b)=>a.page-b.page||a.y-b.y);
 const setStatus=m=>{status.textContent=m};
 const recordSnapshot=()=>({notes:notes(),marks:marks(),book:state.readerBook,pdf:state.pdf});
 $('openCopies').onclick=()=>{if(!state.pdf)return;dlg.hidden=false;setStatus('')};
 $('copiesClose').onclick=()=>dlg.hidden=true;
 dlg.onclick=e=>{if(e.target===dlg)dlg.hidden=true};
 function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
 function safePdf(t){return cleanText(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?')}
 function wrap(t,font,size,max){const result=[];for(const raw of safePdf(t).split(/\n/)){let line='';for(const word of raw.split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)>max&&line){result.push(line);line=word;}else line=candidate;while(font.widthOfTextAtSize(line,size)>max){let pos=line.length-1;while(pos>1&&font.widthOfTextAtSize(line.slice(0,pos),size)>max)pos--;result.push(line.slice(0,pos));line=line.slice(pos)}}result.push(line)}return result}
 async function pdfPortfolio(snap){
  if(!window.PDFLib)throw Error('pdf-lib não carregou.');
  const doc=await PDFLib.PDFDocument.create(), regular=await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  let page=null,y=0;const W=595,H=842,L=53,usable=W-2*L;
  function newPage(){page=doc.addPage([W,H]);y=H-55;page.drawText('PORTFOLIO DE LEITURA',{x:L,y,size:18,font:bold,color:PDFLib.rgb(.07,.24,.4)});y-=42}
  function lines(t,opts={}){const size=opts.size||11,font=opts.bold?bold:regular,gap=opts.gap||17;for(const line of wrap(t,font,size,usable)){if(!page||y<65)newPage();page.drawText(line||' ',{x:L,y,size,font,color:PDFLib.rgb(.12,.18,.25)});y-=gap}}
  newPage();lines('Obra: '+snap.book.title,{bold:true,size:12});lines('Autor: '+(snap.book.author||'Nao informado'));lines('Gerado em: '+new Date().toLocaleString('pt-BR'));y-=16;
  lines('REFLEXOES E ANOTACOES',{bold:true,size:14});y-=8;
  if(!snap.notes.length)lines('Nenhuma anotacao registrada.');
  for(const n of snap.notes){lines('PAGINA '+n.page,{bold:true,size:12});lines(n.text);y-=11}
  y-=10;lines('REFERENCIAS DOS DESTAQUES',{bold:true,size:14});y-=8;
  if(!snap.marks.length)lines('Nenhum destaque registrado.');
  for(const m of snap.marks)lines('Pagina '+m.page+' | Cor '+m.color+' | Area: '+Math.round(m.x*100)+'% da esquerda, '+Math.round(m.y*100)+'% do topo.');
  y-=16;lines('SINTESE PESSOAL',{bold:true,size:14});lines('Espaco para complementar suas reflexoes apos a exportacao.');
  return new Blob([await doc.save()],{type:'application/pdf'});
 }
 async function pdfBook(snap){
  if(!window.PDFLib)throw Error('pdf-lib não carregou.');
  const doc=await PDFLib.PDFDocument.load(await snap.book.pdf.arrayBuffer());const pages=doc.getPages();
  for(const m of snap.marks){const page=pages[m.page-1];if(!page)continue;const {width,height}=page.getSize(),rgb=hexRgb(m.color);const rotate=((page.getRotation().angle||0)%360+360)%360;let x,y,w,h;
    if(rotate===90){x=m.y*width;y=m.x*height;w=m.h*width;h=m.w*height}
    else if(rotate===180){x=(1-m.x-m.w)*width;y=m.y*height;w=m.w*width;h=m.h*height}
    else if(rotate===270){x=(1-m.y-m.h)*width;y=(1-m.x-m.w)*height;w=m.h*width;h=m.w*height}
    else{x=m.x*width;y=(1-m.y-m.h)*height;w=m.w*width;h=m.h*height}
    page.drawRectangle({x,y,width:w,height:h,color:PDFLib.rgb(...rgb),opacity:.38,borderOpacity:0});
  }
  if(snap.notes.length){const f=await doc.embedFont(PDFLib.StandardFonts.Helvetica),head=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);let p=null,y=0;const W=595,H=842,L=52;function newPage(){p=doc.addPage([W,H]);y=H-52;p.drawText('DIARIO DE LEITURA - ANOTACOES',{x:L,y,size:16,font:head,color:PDFLib.rgb(.07,.24,.4)});y-=40}
   newPage();for(const n of snap.notes){if(y<90)newPage();p.drawText('PAGINA '+n.page,{x:L,y,size:12,font:head});y-=22;for(const line of wrap(n.text,f,11,W-2*L)){if(y<60)newPage();p.drawText(line||' ',{x:L,y,size:11,font:f});y-=17}y-=14}
  }
  return new Blob([await doc.save()],{type:'application/pdf'});
 }
 function tRun(s,extra={}){return new docx.TextRun({text:cleanText(s),...extra})}
 function para(s,opts={}){return new docx.Paragraph({children:[tRun(s)],spacing:{after:opts.after??180},heading:opts.heading})}
 async function docxPortfolio(snap){
  if(!window.docx)throw Error('Biblioteca DOCX indisponível. Verifique a internet.');
  const children=[para('PORTFÓLIO DE LEITURA',{heading:docx.HeadingLevel.TITLE}),para(snap.book.title,{heading:docx.HeadingLevel.HEADING_1}),para('Autor: '+(snap.book.author||'Não informado')),para('Gerado em: '+new Date().toLocaleString('pt-BR')),para('REFLEXÕES E ANOTAÇÕES',{heading:docx.HeadingLevel.HEADING_1})];
  if(!snap.notes.length)children.push(para('Nenhuma anotação registrada.'));
  for(const n of snap.notes){children.push(para('Página '+n.page,{heading:docx.HeadingLevel.HEADING_2}),para(n.text))}
  children.push(para('DESTAQUES COLORIDOS',{heading:docx.HeadingLevel.HEADING_1}));
  if(!snap.marks.length)children.push(para('Nenhum destaque registrado.'));
  for(const m of snap.marks)children.push(para(`Página ${m.page} — cor ${m.color}; posição aproximada ${Math.round(m.x*100)}% horizontal e ${Math.round(m.y*100)}% vertical.`));
  children.push(para('SÍNTESE FINAL',{heading:docx.HeadingLevel.HEADING_1}),para('Registre aqui o que você aprendeu com esta leitura.'));
  const document=new docx.Document({sections:[{children}]});return docx.Packer.toBlob(document);
 }
 async function docxBook(snap){
  if(!window.docx)throw Error('Biblioteca DOCX indisponível. Verifique a internet.');
  const children=[para('LIVRO ANOTADO',{heading:docx.HeadingLevel.TITLE}),para(snap.book.title,{heading:docx.HeadingLevel.HEADING_1}),para('Versão de estudo com páginas como imagens, destaques incorporados e notas editáveis.')];
  const pageNotes=new Map();for(const n of snap.notes){if(!pageNotes.has(n.page))pageNotes.set(n.page,[]);pageNotes.get(n.page).push(n)}
  for(let i=1;i<=snap.pdf.numPages;i++){
    setStatus(`Preparando página ${i} de ${snap.pdf.numPages} para o Word...`);
    const page=await snap.pdf.getPage(i);const v=page.getViewport({scale:1});const scale=Math.min(1.45,1000/v.width,1300/v.height);const vp=page.getViewport({scale});
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(vp.width));canvas.height=Math.max(1,Math.ceil(vp.height));const ctx=canvas.getContext('2d',{alpha:false});await page.render({canvasContext:ctx,viewport:vp}).promise;
    for(const m of snap.marks.filter(x=>x.page===i)){ctx.fillStyle=m.color;ctx.globalAlpha=.38;ctx.fillRect(m.x*canvas.width,m.y*canvas.height,m.w*canvas.width,m.h*canvas.height);ctx.globalAlpha=1}
    const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',.83));if(!blob)throw Error('Falha ao gerar a imagem da página '+i);
    const bytes=new Uint8Array(await blob.arrayBuffer());const maxW=480,maxH=620,k=Math.min(maxW/canvas.width,maxH/canvas.height,1);const w=Math.round(canvas.width*k),h=Math.round(canvas.height*k);
    children.push(para('Página '+i,{heading:docx.HeadingLevel.HEADING_2}));children.push(new docx.Paragraph({children:[new docx.ImageRun({data:bytes,transformation:{width:w,height:h},type:'jpg'})],spacing:{after:180}}));
    for(const n of pageNotes.get(i)||[])children.push(para('Anotação: '+n.text));
    // Cada página original começa em uma folha nova, mantendo o layout legível.
    if(i<snap.pdf.numPages)children.push(new docx.Paragraph({pageBreakBefore:true,children:[]}));
    canvas.width=1;canvas.height=1;
  }
  return docx.Packer.toBlob(new docx.Document({sections:[{children}]}));
 }
 async function saveCopy(blob,kind,original){
  const suffix=kind==='book'?' — Livro Anotado':' — Portfólio de Leitura';const title=original.title+suffix;
  const newBook={id:uid(),title,author:original.author||'',category:original.category||'Educação',description:`Cópia pessoal de ${original.title}. Origem: ${kind==='book'?'livro anotado':'portfólio de leitura'}. Criado em ${new Date().toLocaleString('pt-BR')}.`,coverRatio:original.coverRatio||'9:16',cover:original.cover||null,pdf:blob,pdfName:filename(title)+'.pdf',download:true,createdAt:Date.now(),updatedAt:Date.now(),sourceBookId:original.id,generatedKind:kind};
  await saveDB(newBook);await refreshBooks();return newBook;
 }
 go.addEventListener('click',async()=>{
  if(!state.readerBook||!state.pdf)return;
  const kind=dlg.querySelector('input[name="copyKind"]:checked').value,dest=dlg.querySelector('input[name="copyDestination"]:checked').value;
  if(!window.PDFLib){setStatus('Não foi possível carregar o gerador PDF. Verifique a conexão.');return}
  go.disabled=true;setStatus('Preparando seus registros...');
  try{
   clearTimeout(reading.saveTimer);await notesPersist();const snap=recordSnapshot();let blob;
   if(dest==='docx'){blob=kind==='book'?await docxBook(snap):await docxPortfolio(snap);download(blob,filename(snap.book.title)+'_'+(kind==='book'?'livro_anotado':'portfolio')+'.docx')}
   else {blob=kind==='book'?await pdfBook(snap):await pdfPortfolio(snap);if(dest==='pdf')download(blob,filename(snap.book.title)+'_'+(kind==='book'?'livro_anotado':'portfolio')+'.pdf');else{await saveCopy(blob,kind,snap.book)}}
   setStatus(dest==='library'?'Cópia PDF criada na sua galeria local. O livro original foi preservado.':'Arquivo gerado. Consulte a pasta de downloads.');toast(dest==='library'?'Cópia criada na biblioteca!':'Download iniciado.');
  }catch(err){console.error(err);setStatus('Não foi possível gerar a cópia: '+err.message);toast('Erro ao gerar cópia.',true)}finally{go.disabled=false}
 });
})();
