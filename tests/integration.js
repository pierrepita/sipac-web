"use strict";
document.getElementById('run').onclick=async()=>{
 const out=document.getElementById('status');out.textContent='Executando…';
 try{
 const n='23066.026112/2026-79',base='https://sipac.ufba.br',original=new TextEncoder().encode('%PDF-1.7\noriginal\n\u0000\u00ff'),signed=new TextEncoder().encode('%PDF-1.7\nassinaturas\n'),extra=new TextEncoder().encode('%PDF-1.7\nextra\n');let retried=false;
 const row=(order,type,actions,nature='OSTENSIVO')=>'<tr><td>'+order+'</td><td>'+type+'</td><td>15/11/2026</td><td>UFBA</td><td>'+nature+'</td><td>'+actions+'</td></tr>';
 const action=(u,alt)=>'<a onclick="window.open(\''+u+'\')"><img alt="'+alt+'"></a>';
 const info=id=>'<a onclick="documentoPublicoDetalhado('+id+')">Dados</a>';
 const detail='<table><tr><th>Processo:</th><td>'+n+'</td></tr><tr><th>Assunto:</th><td>Alteração curricular</td></tr></table><table><caption>Documentos do Processo</caption><tbody>'+row(1,'OFICIO',action('/public/verArquivoDocumento?idArquivo=1&key=a','Visualizar Documento Original')+action('/public/verArquivoDocumento?idArquivo=1&key=a&idDocumento=1','Visualizar Documento')+info(1))+row(2,'DESPACHO',action('/public/jsp/processos/documento_visualizacao.jsf?idDoc=2','Visualizar Documento com Folha de Assinatura')+info(2))+row(3,'HISTORICO','','RESTRITO')+'</tbody><tfoot><tr><td colspan=7>Número de documentos no processo: 3</td></tr></tfoot></table>';
 const native='<html><body><p>Pré-requisitos e alteração curricular</p><p>Assinado eletronicamente</p><p>Processo Associado: '+n+'</p><script>window.evil=1;</script><img src="https://evil.test/track"><p onclick="evil()">Texto</p></body></html>';
 const meta=(type,extra='')=>'<table><tr><th>Tipo do Documento:</th><td>'+type+'</td></tr><tr><th>Assunto Detalhado:</th><td>Descrição com acentuação</td></tr></table>'+extra;
 const response=(body,charset='utf-8',status=200,type='text/html')=>new Response(typeof body==='string'?(charset==='iso-8859-1'?new Uint8Array(Array.from(body).map(c=>c.charCodeAt(0))):new TextEncoder().encode(body)):body,{status,headers:{'Content-Type':type+'; charset='+charset}});
 const requests=[];
 const fetcher=async(u,options)=>{
  requests.push(u);const url=new URL(u);
  if(url.pathname.endsWith('/portal.jsf')&&options.method==='GET')return response('<form id="processoForm" action="/public/jsp/portal.jsf;jsessionid=public"><input type="hidden" name="processoForm" value="processoForm"><input name="javax.faces.ViewState" value="dynamic"><input type="submit" name="dynamicButton" value="Consultar Processo"></form>');
  if(url.pathname.includes('/portal.jsf')&&options.method==='POST'){if(options.body.get('NUM_PROTOCOLO')!=='026112'||options.body.get('javax.faces.ViewState')!=='dynamic')throw new Error('Formulário incorreto');return response('<table><tr><td>'+n+'</td><td><a href="/public/jsp/processos/processo_detalhado.jsf?id=1">Ver</a></td></tr></table>');}
  if(url.pathname.endsWith('/processo_detalhado.jsf'))return response(detail,'iso-8859-1');
  if(url.pathname.endsWith('/info_documento.jsf'))return response(meta(url.searchParams.get('idDoc')==='1'?'OFICIO':'DESPACHO',url.searchParams.get('idDoc')==='1'?action('/public/verArquivoDocumento?idArquivo=3&key=x','Extra'):''),'iso-8859-1');
  if(url.pathname.endsWith('/documento_visualizacao.jsf'))return response(native);
  if(url.pathname.endsWith('/verArquivoDocumento')){if(url.searchParams.get('idDocumento')&&!retried){retried=true;return response('Temporário','utf-8',503);}return response(url.searchParams.get('idArquivo')==='3'?extra:url.searchParams.get('idDocumento')?signed:original,'utf-8',200,'application/download');}
  throw new Error('URL inesperada '+u);
 };
 const result=await SipacWebCore.collect('026112/26-79',{fetcher,progress:m=>{out.textContent=m;}});
 const assert=(x,msg)=>{if(!x)throw new Error(msg);};
 assert(result.record.total_listado===3,'Contagem da lista');assert(result.record.total_salvo===2,'Restrito não pode ser salvo');assert(result.record.pendencias===1,'Pendência do restrito');assert(result.record.total_arquivos===4,'Original, assinaturas, extra e HTML');assert(retried,'Nova tentativa HTTP 503');assert(result.record.cabecalho.Assunto==='Alteração curricular','Decodificação Latin1');
 assert(result.record.documentos[0].descricao==='Descrição com acentuação','Metadados acentuados');
 const html=result.entries.find(f=>f.name.includes('002_despacho_com_assinaturas')).bytes;const text=new TextDecoder().decode(html);assert(text.includes('Pré-requisitos'),'UTF8 preservado');assert(!text.includes('<script')&&!text.includes('onclick')&&!text.includes('<img'),'Sanitização HTML');
 const index=new DOMParser().parseFromString(new TextDecoder().decode(result.entries.find(e=>e.name==='indice.html').bytes),'text/html');const names=new Set(result.entries.map(e=>e.name));assert([...index.querySelectorAll('a[href^="documentos/"]')].every(a=>names.has(a.getAttribute('href'))),'Links locais');
 const pdf=result.entries.find(e=>e.name==='documentos/001_oficio_original_1.pdf').bytes;assert(pdf.length===original.length&&pdf.every((b,i)=>b===original[i]),'PDF preservado');
 const control=result.record.controle_cae;assert(control.colunas.length===17&&control.valores[0]==='026112/26-79','Controle CAE e máscara curta');
 const tsv=new TextDecoder().decode(result.entries.find(e=>e.name==='controle-cae.tsv').bytes);assert(tsv.split('\r\n')[1].split('\t').length===17,'Alinhamento TSV');assert(result.entries.some(e=>e.name==='controle-cae.js'),'Script do índice offline');
 const box=document.getElementById('cae');box.innerHTML=SipacWebCore.renderControl(control);SipacWebCore.installCaeControls(box);
 const file=SipacWebCore.makeZip(result.entries),a=document.getElementById('zip');a.href=URL.createObjectURL(file);a.download='teste-sipac-web.zip';a.hidden=false;
 out.textContent='PASSOU: consulta JSF, 3 documentos listados, 2 acessíveis, 4 arquivos de conteúdo, anexo adicional, HTTP 503, Latin1 e UTF8, sanitização, integridade de PDF, links locais, máscara curta e controle CAE com 17 colunas.\nZIP: '+result.entries.length+' arquivos.';
 }catch(error){out.textContent='FALHOU: '+error.stack;}
};
