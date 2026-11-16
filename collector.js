(function (global) {
  "use strict";
  const BASE = "https://sipac.ufba.br";
  const MAX_FILE = 64 * 1024 * 1024;
  const MAX_TOTAL = 180 * 1024 * 1024;
  const encoder = new TextEncoder();
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  const fold = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = value => fold(value).replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70) || "documento";
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  function number(value) {
    value = String(value || "").trim();
    if (/^\d{17}$/.test(value)) value = value.slice(0,5)+"."+value.slice(5,11)+"/"+value.slice(11,15)+"-"+value.slice(15);
    if (!/^\d{5}\.\d{6}\/\d{4}-\d{2}$/.test(value)) throw new Error("Informe o número completo, como 23066.026112/2026-79.");
    return value;
  }
  function safeURL(value, base = BASE) {
    const u = new URL(value, base);
    if (u.origin !== BASE || u.username || u.password || !u.pathname.startsWith("/public/")) throw new Error("Endereço fora da consulta pública do SIPAC/UFBA.");
    return u.href;
  }
  function parse(response) {
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(response.type || "");
    const decoder = new TextDecoder(charset ? charset[1] : "utf-8");
    return new DOMParser().parseFromString(decoder.decode(response.bytes), "text/html");
  }
  function visible(doc) {
    const clone = doc.cloneNode(true);
    clone.querySelectorAll("script,style").forEach(el => el.remove());
    return fold(clean(clone.body?.textContent));
  }
  function requireContent(doc) {
    if (doc.querySelector('input[type="password"]')) throw new Error("O SIPAC pediu autenticação para este item.");
    if (/acesso negado|acesso nao autorizado|nao possui permissao|nao tem permissao|documento nao encontrado|sessao expirada|erro inesperado|erro interno|nao foi possivel visualizar/.test(visible(doc))) throw new Error("Conteúdo indisponível na consulta pública.");
    return doc;
  }
  function fields(doc) {
    const result = {};
    doc.querySelectorAll("tr").forEach(row => {
      const cells = Array.from(row.children).filter(el => /^(TH|TD)$/.test(el.tagName));
      for (let i = 0; i < cells.length - 1; i++) {
        const key = clean(cells[i].textContent).replace(/[:\s]+$/, "");
        if (cells[i].tagName === "TH" && cells[i+1].tagName === "TD" && key && !cells[i+1].querySelector("table")) result[key] = clean(cells[i+1].textContent);
      }
    });
    return result;
  }
  function tableNamed(doc, name) {
    return Array.from(doc.querySelectorAll("table")).find(t => Array.from(t.children).some(c => c.tagName === "CAPTION" && clean(c.textContent).includes(name)));
  }
  function grid(doc, name) {
    const t = tableNamed(doc, name);
    if (!t) return {colunas:[],linhas:[]};
    return {colunas:Array.from(t.tHead?.rows[0]?.cells || []).map(c => clean(c.textContent)),linhas:Array.from(t.rows).filter(r => r.cells[0]?.tagName === "TD").map(r => Array.from(r.cells).map(c => clean(c.textContent)))};
  }
  function formFields(form) {
    const data = new URLSearchParams();
    form.querySelectorAll("input[name]").forEach(el => {
      if (el.disabled || /^(submit|button|file|reset|image)$/i.test(el.type) || (/^(checkbox|radio)$/i.test(el.type) && !el.checked)) return;
      data.set(el.name, el.value);
    });
    return data;
  }
  function actionURL(a, base) {
    const m = /window\.open\(\s*['"]([^'"]+)['"]/.exec(a.getAttribute("onclick") || "");
    if (m) return safeURL(m[1], base);
    const href = a.getAttribute("href") || "";
    return href && !/^(#|javascript:)/i.test(href) ? safeURL(href, base) : null;
  }
  function documents(doc, base) {
    const table = tableNamed(doc, "Documentos do Processo");
    if (!table) throw new Error("A tabela de documentos não foi reconhecida. A tela do SIPAC pode ter mudado.");
    const result = [];
    for (const row of Array.from(table.rows)) {
      if (row.parentElement?.tagName === "TFOOT") continue;
      const c = Array.from(row.cells);
      if (!c.length || c[0].tagName !== "TD") continue;
      if (c.length < 5) { if (!/nenhum/i.test(row.textContent)) throw new Error("Linha de documento não reconhecida."); else continue; }
      const order = clean(c[0].textContent);
      if (!/^\d+$/.test(order)) throw new Error("Numeração inesperada na lista de documentos.");
      const d = {ordem:Number(order),tipo:clean(c[1].textContent),data:clean(c[2].textContent),origem:clean(c[3].textContent),natureza:clean(c[4].textContent),id:"",descricao:clean(c[1].textContent),acoes:[],arquivos:[],avisos:[],erros:[],status:"pendente"};
      const seen = new Set();
      for (const a of row.querySelectorAll("a")) {
        const info = /documentoPublicoDetalhado\((\d+)\)/.exec(a.getAttribute("onclick") || "");
        if (info) { d.id = info[1]; continue; }
        const u = actionURL(a, base);
        if (!u || seen.has(u)) continue;
        if (!/verArquivoDocumento|documento_visualizacao\.jsf/.test(new URL(u).pathname)) { d.avisos.push("Ação de documento não reconhecida; confira no SIPAC."); continue; }
        const label = a.querySelector("img")?.getAttribute("alt") || clean(a.textContent);
        d.acoes.push({url:u,variante:label.includes("Original") ? "original" : "com_assinaturas"});
        seen.add(u);
        d.id ||= new URL(u).searchParams.get("idDocumento") || new URL(u).searchParams.get("idDoc") || "";
      }
      if (d.id) d.url_dados = BASE+"/public/jsp/processos/info_documento.jsf?idDoc="+d.id;
      result.push(d);
    }
    return result;
  }
  function nextPage(doc) {
    for (const pager of doc.querySelectorAll('[class*="paginador"],[class*="paginacao"],[class*="paginator"]')) {
      const links = Array.from(pager.querySelectorAll("a"));
      const next = links.find(a => /proxima|seguinte|next/.test(fold(clean(a.textContent+" "+(a.title || "")+" "+(a.querySelector("img")?.alt || "")))) || /^[>›»]+$/.test(clean(a.textContent)));
      if (next) return next;
      if (links.length) {
        const current = pager.querySelector('.atual,.selected,strong,b');
        const nums = links.map(a => clean(a.textContent)).filter(n => /^\d+$/.test(n)).map(Number);
        if (!current || !/^\d+$/.test(clean(current.textContent)) || Math.max(0,...nums) > Number(clean(current.textContent))) throw new Error("Paginação não reconhecida; não foi possível conferir a lista inteira.");
      }
    }
    return null;
  }
  const CSS = 'body{font:15px/1.55 Arial,sans-serif;color:#203649;background:#f3f5f4;margin:0}main{max-width:1150px;margin:30px auto;background:white;padding:32px;border-radius:14px}h1{font-size:28px;overflow-wrap:anywhere}h2{font-size:20px;margin-top:30px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;border-bottom:1px solid #dce4e6;padding:10px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf3f3}a{color:#147b71}.muted{font-size:12px;color:#667b86}.note{background:#eaf5f0;padding:15px;border-radius:9px}.links a{display:block;margin-bottom:7px}.scroll{overflow:auto}.warn{color:#96500d}@media print{body{background:white}main{padding:0;margin:0}tr{break-inside:avoid}thead{display:table-header-group}}';
  function page(title, body) { return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>'+CSS+'</style></head><body><main>'+body+'</main></body></html>'; }
  function fieldTable(values) { return '<table>'+Object.entries(values).map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v || "Não informado")+'</td></tr>').join("")+'</table>'; }
  function gridTable(data) { return '<div class="scroll"><table><thead><tr>'+data.colunas.map(c=>'<th>'+esc(c)+'</th>').join("")+'</tr></thead><tbody>'+data.linhas.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'; }
  function safeFragment(doc) {
    const body = doc.body.cloneNode(true);
    body.querySelectorAll('script,style,link,meta,iframe,object,embed,img,input,button,textarea,select,svg,video,audio').forEach(el=>el.remove());
    const tags = /^(BODY|DIV|P|SPAN|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|STRONG|B|I|EM|U|S|BR|HR|CENTER|OL|UL|LI|H1|H2|H3|H4|A|CAPTION|SMALL|SUP|SUB|FONT)$/;
    for (const el of Array.from(body.querySelectorAll("*"))) {
      Array.from(el.attributes).forEach(a=>{ if (!['href','colspan','rowspan','align'].includes(a.name)) el.removeAttribute(a.name); });
      if (el.hasAttribute("href")) { try { el.setAttribute("href",safeURL(el.getAttribute("href"))); } catch { el.removeAttribute("href"); } }
      if (!tags.test(el.tagName)) el.replaceWith(...el.childNodes);
    }
    return body.innerHTML;
  }
  function extension(response) {
    if (!response.bytes.length) throw new Error("O SIPAC retornou um arquivo vazio.");
    const magic = new TextDecoder().decode(response.bytes.slice(0,120)).trimStart();
    if (magic.startsWith("%PDF-")) return "pdf";
    if (/html/i.test(response.type) || /^<!doctype html|^<html/i.test(magic)) return "html";
    if (response.bytes[0]===137 && response.bytes[1]===80 && response.bytes[2]===78) return "png";
    if (response.bytes[0]===255 && response.bytes[1]===216 && response.bytes[2]===255) return "jpg";
    const filename = /filename\*?\s*=\s*(?:UTF-8''|["'])?([^;\r\n]+)/i.exec(response.disposition || "")?.[1]?.replace(/["']+$/, "") || "";
    const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
    if (ext && /^(docx?|xlsx?|csv|txt|odt|ods|zip|rtf|pptx?|xml)$/.test(ext)) return ext;
    throw new Error("Formato não reconhecido; confira o arquivo no SIPAC.");
  }
  function report(record) {
    let body = '<p class="muted">SIPAC Web · cópia local da consulta pública</p><h1>Processo '+esc(record.processo)+'</h1><p class="muted">Consulta em '+esc(record.consultado_em)+' · <a href="'+esc(record.fonte)+'">Ver no SIPAC</a></p><p class="note"><b>'+record.total_salvo+' de '+record.total_listado+' documentos listados com todas as versões acessíveis salvas.</b><br>O resultado cobre a lista apresentada na consulta pública. Itens totalmente ocultos não podem ser enumerados.</p><h2>Cabeçalho</h2>'+fieldTable(record.cabecalho);
    if (record.interessados.linhas.length) body += '<h2>Interessados</h2>'+gridTable(record.interessados);
    body += '<h2>Documentos e despachos</h2><div class="scroll"><table><thead><tr><th>Ordem</th><th>Documento e descrição</th><th>Data / origem</th><th>Arquivos locais</th><th>Resultado</th></tr></thead><tbody>';
    for (const d of record.documentos) {
      let links = d.arquivos.map(f=>'<a href="'+encodeURI(f.caminho)+'">'+({original:'Original',com_assinaturas:'Com assinaturas',anexo_adicional:'Anexo adicional'}[f.variante])+' · '+esc(f.formato.toUpperCase())+'</a>').join("");
      if (d.arquivo_dados) links += '<a href="'+encodeURI(d.arquivo_dados)+'">Dados do documento</a>';
      body += '<tr><td>'+String(d.ordem).padStart(3,"0")+'</td><td><b>'+esc(d.tipo)+'</b>'+(d.descricao!==d.tipo?'<br>'+esc(d.descricao):'')+'</td><td>'+esc(d.data)+'<br><span class="muted">'+esc(d.origem)+'</span></td><td class="links">'+(links || '—')+'</td><td>'+esc(d.status==='baixado'?'Salvo':d.status)+'<br><span class="warn">'+d.erros.map(esc).join('<br>')+'</span></td></tr>';
    }
    body += '</tbody></table></div>';
    if (record.movimentacoes.linhas.length) body += '<h2>Movimentações</h2>'+gridTable(record.movimentacoes);
    const notes = record.documentos.flatMap(d=>[...d.erros,...d.avisos].map(v=>'Documento '+d.ordem+': '+v));
    if (notes.length) body += '<h2>Pendências e observações</h2><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul>';
    return page(record.processo,body+'<p class="muted">Mantenha este índice e a pasta documentos juntos. PDFs foram preservados como recebidos. Documentos eletrônicos em HTML têm uma cópia passiva do conteúdo exibido.</p>');
  }
  function csv(record) {
    const cell = v => {v=String(v ?? "");if (/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[['Ordem','Tipo','Descrição','Data','Origem','Natureza','Resultado','Arquivos','Pendências'],...record.documentos.map(d=>[d.ordem,d.tipo,d.descricao,d.data,d.origem,d.natureza,d.status,d.arquivos.map(f=>f.caminho).join(' | '),[...d.erros,...d.avisos].join(' | ')])].map(r=>r.map(cell).join(';')).join('\r\n');
  }
  async function collect(input, options = {}) {
    const process = number(input), fetcher=options.fetcher || global.fetch.bind(global), signal=options.signal;
    const notify = options.progress || (()=>{}), entries = []; let totalBytes=0;
    function add(name, value) { const bytes=typeof value==='string'?encoder.encode(value):value;if(totalBytes+bytes.length>MAX_TOTAL)throw new Error('Limite de 180 MB para o pacote no navegador atingido.');entries.push({name,bytes});totalBytes+=bytes.length; }
    async function request(value, data) {
      const url=safeURL(value);
      for (let attempt=0;attempt<3;attempt++) {
        if(signal?.aborted)throw new DOMException('Consulta cancelada.','AbortError');
        const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),45000), cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
        try {
          const res=await fetcher(url,{method:data?'POST':'GET',body:data,credentials:'same-origin',redirect:'follow',signal:controller.signal});
          if(res.url)safeURL(res.url);
          if(!res.ok) {if([429,502,503,504].includes(res.status)&&attempt<2){await pause(600*(attempt+1));continue;}throw new Error('SIPAC respondeu HTTP '+res.status+'.');}
          if(Number(res.headers.get('content-length') || 0)>MAX_FILE)throw new Error('Arquivo supera 64 MB por resposta.');
          const reader=res.body?.getReader();let bytes;
          if(reader){const chunks=[];let length=0;for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>MAX_FILE){await reader.cancel();throw new Error('Arquivo supera 64 MB por resposta.');}chunks.push(next.value);}bytes=new Uint8Array(length);let p=0;for(const chunk of chunks){bytes.set(chunk,p);p+=chunk.length;}}
          else bytes=new Uint8Array(await res.arrayBuffer());
          if(bytes.length>MAX_FILE)throw new Error('Arquivo supera 64 MB por resposta.');
          return {url:res.url || url,bytes,type:res.headers.get('content-type') || '',disposition:res.headers.get('content-disposition') || ''};
        } catch(error) {if(signal?.aborted)throw new DOMException('Consulta cancelada.','AbortError');if(attempt<2&&!data&&/fetch|network|aborted|timeout/i.test(error.message)){await pause(600*(attempt+1));continue;}throw error;}
        finally {clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
      }
    }
    notify('Consultando o processo '+process+'…',0,0);
    let response=await request(BASE+'/public/jsp/portal.jsf'),doc=requireContent(parse(response));
    const form=doc.querySelector('form[id="processoForm"]');if(!form)throw new Error('Formulário público não reconhecido. A tela do SIPAC pode ter mudado.');
    const data=formFields(form), parts=process.match(/(\d{5})\.(\d{6})\/(\d{4})-(\d{2})/);
    ['RADICAL_PROTOCOLO','NUM_PROTOCOLO','ANO_PROTOCOLO','DV_PROTOCOLO'].forEach((key,i)=>data.set(key,parts[i+1]));
    const submit=Array.from(form.querySelectorAll('input[type="submit"]')).find(i=>/Consultar Processo/i.test(i.value));if(!submit)throw new Error('Botão de consulta não reconhecido.');data.set(submit.name,submit.value);
    response=await request(safeURL(form.getAttribute('action'),response.url),data);doc=requireContent(parse(response));
    const links=new Set();doc.querySelectorAll('tr').forEach(r=>{if(clean(r.textContent).includes(process))r.querySelectorAll('a[href*="processo_detalhado.jsf"]').forEach(a=>links.add(safeURL(a.getAttribute('href'),response.url)));});
    if(links.size!==1)throw new Error(links.size?'A consulta retornou resultados ambíguos.':'Processo não localizado na consulta pública. Confira o número no SIPAC.');
    response=await request([...links][0]);doc=requireContent(parse(response));
    const header=fields(doc);if(header.Processo!==process)throw new Error('O número do cabeçalho não corresponde ao solicitado.');
    const record={versao:'1.0',processo:process,consultado_em:new Date().toISOString(),fonte:response.url,escopo:'consulta_publica',cabecalho:header,interessados:grid(doc,'Interessados Deste Processo'),movimentacoes:grid(doc,'Movimentações do Processo'),documentos:[]};
    const seenPages=new Set();let declaredTotal=null;
    for(let count=0;count<200;count++){
      const footer=tableNamed(doc,'Documentos do Processo')?.tFoot;
      const declared=/numero de documentos no processo\s*:\s*(\d+)/.exec(fold(clean(footer?.textContent)));
      if(declared){const total=Number(declared[1]);if(declaredTotal!==null&&declaredTotal!==total)throw new Error('O total de documentos mudou durante a consulta. Tente novamente.');declaredTotal=total;}
      const docs=documents(doc,response.url), fingerprint=JSON.stringify(docs.map(d=>[d.ordem,d.id]));if(seenPages.has(fingerprint))throw new Error('O paginador repetiu uma página. Lista não confirmada.');seenPages.add(fingerprint);record.documentos.push(...docs);
      const next=nextPage(doc);if(!next)break;if(count===199)throw new Error('Limite de paginação atingido.');
      const url=actionURL(next,response.url);
      if(url)response=await request(url);else{
        const js=next.getAttribute('onclick') || '',fid=/getElementById\(['"]([^'"]+)['"]\)/.exec(js)?.[1],f=fid?doc.getElementById(fid):null,pairs=[...js.matchAll(/'([^']+)'\s*:\s*'([^']*)'/g)];if(!f||!pairs.length)throw new Error('Ação de paginação não reconhecida.');const values=formFields(f);pairs.forEach(p=>values.set(p[1],p[2]));response=await request(safeURL(f.getAttribute('action'),response.url),values);
      }doc=requireContent(parse(response));
    }
    record.documentos.sort((a,b)=>a.ordem-b.ordem);record.total_listado=record.documentos.length;
    if(declaredTotal!==null&&declaredTotal!==record.total_listado)throw new Error('A lista obtida não corresponde ao total de documentos informado pelo SIPAC.');
    if(!record.total_listado)throw new Error('Nenhum documento listado nesta consulta.');
    if(new Set(record.documentos.map(d=>d.ordem)).size!==record.total_listado)throw new Error('Numeração duplicada na lista. Cópia interrompida.');
    async function download(d) {
      d.erros=[];d.avisos=d.avisos.filter(v=>!v.startsWith('Dados complementares:'));
      const prefix=String(d.ordem).padStart(3,'0')+'_'+slug(d.tipo);
      if(d.url_dados&&!d.arquivo_dados){try{
        const info=await request(d.url_dados), dom=requireContent(parse(info)), meta=fields(dom);if(!meta['Tipo do Documento'])throw new Error('Página de dados não reconhecida.');d.dados=meta;d.descricao=meta['Assunto Detalhado'] || d.tipo;
        const name='documentos/'+prefix+'_dados.html';add(name,page('Dados do documento',fieldTable(meta)));d.arquivo_dados=name;
        const urls=new Set(d.acoes.map(a=>a.url));dom.querySelectorAll('a').forEach(a=>{const u=actionURL(a,info.url);if(u&&!urls.has(u)&&/verArquivoDocumento|documento_visualizacao\.jsf/.test(new URL(u).pathname)){d.acoes.push({url:u,variante:'anexo_adicional'});urls.add(u);}});
      }catch(error){if(error.name==='AbortError')throw error;d.avisos.push('Dados complementares: '+error.message);}}
      if(!d.acoes.length){d.status=/restrit|sigilos/.test(fold(d.natureza))?'restrito':'indisponivel';d.erros.push('Nenhum link de conteúdo acessível na consulta pública.');return;}
      for(let index=0;index<d.acoes.length;index++){
        const action=d.acoes[index];if(d.arquivos.some(f=>f.fonte===action.url))continue;
        try{
          const file=await request(action.url), ext=extension(file);let bytes=file.bytes;
          if(ext==='html'){const dom=requireContent(parse(file)),v=visible(dom);if(!v.includes('assinado eletronicamente')||!v.includes('processo associado'))throw new Error('Resposta não reconhecida como documento eletrônico do SIPAC.');bytes=encoder.encode(page(d.tipo,'<p class="muted">Cópia local da consulta pública · SIPAC UFBA</p>'+safeFragment(dom)));}
          const name='documentos/'+prefix+'_'+action.variante+'_'+(index+1)+'.'+ext;
          const digest=Array.from(new Uint8Array(await global.crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
          add(name,bytes);
          d.arquivos.push({caminho:name,variante:action.variante,formato:ext,bytes:bytes.length,sha256:digest,fonte:action.url});
        }catch(error){if(error.name==='AbortError')throw error;d.erros.push(action.variante+': '+error.message);}
        await pause(120);
      }
      d.status=d.arquivos.length===d.acoes.length&&!d.erros.length?'baixado':d.arquivos.length?'parcial':'erro';
    }
    let cursor=0,done=0;
    async function worker(){while(cursor<record.documentos.length){const d=record.documentos[cursor++];await download(d);notify('Documento '+String(d.ordem).padStart(3,'0')+': '+d.tipo+' — '+d.status,++done,record.total_listado);}}
    await Promise.all([worker(),worker()]);
    for(const d of record.documentos.filter(d=>d.acoes.length&&(d.erros.length||d.avisos.some(v=>v.startsWith('Dados complementares:'))))){notify('Tentando novamente os itens ausentes do documento '+d.ordem+'…',done,record.total_listado);await download(d);}
    record.total_salvo=record.documentos.filter(d=>d.status==='baixado').length;record.total_arquivos=record.documentos.reduce((n,d)=>n+d.arquivos.length,0);record.pendencias=record.documentos.filter(d=>d.erros.length||d.avisos.length).length;record.concluido_em=new Date().toISOString();
    add('indice.html',report(record));add('documentos.csv',csv(record));add('processo.json',JSON.stringify(record,null,2));
    return {record,entries};
  }
  let crcTable;
  function crc32(bytes) {if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function makeZip(entries) {
    if(entries.length>65535)throw new Error('Muitos arquivos para o formato ZIP.');
    const chunks=[],central=[];let offset=0,centralSize=0;const now=new Date(),date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
    for(const entry of entries){
      if(!entry.name||entry.name.startsWith('/')||entry.name.includes('\\')||entry.name.split('/').some(p=>p==='..'||p===''))throw new Error('Caminho de arquivo inválido no ZIP.');
      const name=encoder.encode(entry.name),bytes=entry.bytes,crc=crc32(bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(10,time,true);lv.setUint16(12,date,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,bytes);
      const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(12,time,true);cv.setUint16(14,date,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);cen.set(name,46);central.push(cen);centralSize+=cen.length;offset+=local.length+bytes.length;
    }
    const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
  }
  async function run() {
    if(global.location.origin!==BASE){global.alert('Abra a consulta pública do SIPAC/UFBA e clique no favorito “Baixar SIPAC” nessa aba.');return;}
    const existing=global.document.getElementById('sipac-web-panel');if(existing){existing.scrollIntoView();return;}
    let input=new URLSearchParams(global.location.hash.slice(1)).get('sipac-web');
    if(!input)input=global.prompt('Número completo do processo:',fields(global.document).Processo || '');if(!input)return;
    let process;try{process=number(input);}catch(error){global.alert(error.message);return;}
    const host=global.document.createElement('div');host.id='sipac-web-panel';host.style.cssText='position:fixed;right:22px;bottom:22px;z-index:2147483647;width:min(440px,calc(100vw - 30px));';const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML='<style>:host{all:initial}.panel{font:14px/1.5 Arial,sans-serif;background:white;color:#20394a;border:1px solid #cad9d8;border-radius:16px;box-shadow:0 14px 70px #102c4340;padding:24px}h2{margin:0 0 7px;font-size:20px}p{margin:8px 0;overflow-wrap:anywhere}.muted{color:#657a85;font-size:12px}progress{width:100%;height:8px;margin:16px 0;accent-color:#147d6b}button,a{font:700 13px Arial,sans-serif;border:0;border-radius:8px;padding:12px 15px;cursor:pointer;text-decoration:none}button{background:#edf1f3;color:#3c5665}a{display:block;background:#147d6b;color:white;text-align:center;margin:14px 0}a[hidden]{display:none}.error{color:#9b4d24}.row{display:flex;justify-content:space-between;align-items:center;gap:12px}details{font-size:11px;color:#677c85;margin:12px 0}ol{max-height:140px;overflow:auto;padding-left:20px}</style><div class="panel" role="dialog" aria-label="SIPAC Web"><div class="row"><h2>SIPAC Web</h2><button id="close" type="button">Cancelar</button></div><p id="process"></p><p id="status" role="status">Iniciando consulta…</p><progress id="progress"></progress><p class="muted" id="summary">Mantenha esta aba aberta durante a consulta.</p><a id="download" hidden>Baixar ZIP do processo</a><details><summary>Detalhes da consulta</summary><ol id="log"></ol></details><p class="muted">A coleta ocorre neste navegador. Os documentos não são enviados ao GitHub. Depois do download, extraia o ZIP e abra indice.html.</p></div>';
    global.document.body.append(host);shadow.getElementById('process').textContent=process;
    const controller=new AbortController();let finished=false,objectURL;
    shadow.getElementById('close').onclick=()=>{if(!finished){controller.abort();return;}if(objectURL)URL.revokeObjectURL(objectURL);host.remove();};
    try{
      const result=await collect(process,{signal:controller.signal,progress:(message,done,total)=>{shadow.getElementById('status').textContent=message;const p=shadow.getElementById('progress');if(total){p.max=total;p.value=done;}const li=global.document.createElement('li');li.textContent=message;shadow.getElementById('log').append(li);}});
      const blob=makeZip(result.entries);objectURL=URL.createObjectURL(blob);const a=shadow.getElementById('download');a.href=objectURL;a.download=slug(process)+'.zip';a.hidden=false;
      shadow.getElementById('status').textContent='Consulta concluída.';shadow.getElementById('summary').textContent=result.record.total_salvo+' de '+result.record.total_listado+' documentos listados salvos · '+result.record.total_arquivos+' arquivos de conteúdo · '+result.record.pendencias+' pendências.';
    }catch(error){shadow.getElementById('status').textContent=error.name==='AbortError'?'Consulta cancelada.':error.message;shadow.getElementById('status').className='error';shadow.getElementById('summary').textContent='Você pode fechar este painel e tentar novamente. Nenhum pacote foi apresentado como completo.';}
    finally{finished=true;shadow.getElementById('close').textContent='Fechar';}
  }
  const api={number,safeURL,slug,parse,fields,formFields,documents,nextPage,safeFragment,extension,report,csv,collect,crc32,makeZip,run};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  global.SipacWebCore=api;
  if(!global.document.currentScript?.hasAttribute('data-library'))void run();
})(typeof window==='undefined'?globalThis:window);
