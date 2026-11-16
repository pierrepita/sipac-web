const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./collector.js');
const utf8 = new TextEncoder();

test('aceita NUP completo e rejeita entradas incompletas',()=>{
  assert.equal(core.number('23066026112202679'),'23066.026112/2026-79');
  assert.equal(core.number(' 23066.026112/2026-79 '),'23066.026112/2026-79');
  assert.equal(core.number('006904/23-84'),'23066.006904/2023-84');
  assert.equal(core.number(' 006904/23-84 '),'23066.006904/2023-84');
  assert.equal(core.number('23066.006904/2023-84'),'23066.006904/2023-84');
  assert.equal(core.number('000001/00-00'),'23066.000001/2000-00');
  for(const n of ['026112','23066.026112/2026','../arquivo','<script>',''])assert.throws(()=>core.number(n));
});
test('controle CAE tem as 17 colunas e usa recebimento no destino CAE',()=>{
  const r={processo:'23066.006904/2023-84',cabecalho:{'Unidade de Origem':'DEPARTAMENTO DE CIRURGIA/FMB (12.01.21.22)','Assunto Detalhado':'Proposta de Criação do Programa de Residência Médica em Cirurgia Cardiovascular','Data de Autuação':'07/02/2023 11:20'},movimentacoes:{colunas:['Data Origem','Unidade Origem','Unidade Destino','Recebido Em'],linhas:[['19/02/2026','PROPG','CONSELHO ACADÊMICO DE ENSINO /UFBA','23/02/2026 11:33'],['14/10/2026','CAE/UFBA','CARE','20/10/2026'],['01/01/2026','X','CGAE','02/01/2026']]}};
  const c=core.buildCae(r);
  assert.deepEqual(c.colunas,['Processo','Nível','Unidade de Origem','Título','Relator','Tipo','Sugestão de prazo','Data Abertura','Data Recebimento','Data Distribuição','Data Parecer','Dias até Parecer','Data Apreciação','Situação','Parecer','Final','OBS']);
  assert.deepEqual(c.valores,['006904/23-84','PÓS','FMB - Faculdade de Medicina',r.cabecalho['Assunto Detalhado'],'A definir','Criação de curso','30','07/02/2023','23/02/2026','A definir','A definir','A definir','A definir','Em análise','A definir','A definir','A definir']);
  assert.equal(core.controlTsv(c).split('\t').length,17);
  assert.equal(core.controlTsv(c,true).split('\r\n').length,2);
  assert.ok(core.renderControl(c).includes('data-cae-copy'));
});
test('controle não adivinha nível ou datas e usa o recebimento CAE mais recente',()=>{
  const r={processo:'23066.006904/2023-84',cabecalho:{'Data de Autuação':'31/02/2023'},movimentacoes:{colunas:['Destino','Recebido Em'],linhas:[['CAE','31/02/2026'],['CAE','15/01/2025'],['CAE','23/02/2026']]}};
  const c=core.buildCae(r);assert.equal(c.valores[1],'A definir');assert.equal(c.valores[5],'A definir');assert.equal(c.valores[7],'A definir');assert.equal(c.valores[8],'23/02/2026');
  r.movimentacoes.linhas=[['PROPG','23/02/2026']];assert.equal(core.buildCae(r).valores[8],'A definir');
  assert.equal(core.shortNumber('12345.006904/2023-84'),'12345.006904/2023-84');
  assert.equal(core.shortNumber('23066.006904/1923-84'),'23066.006904/1923-84');
});
test('TSV do controle conserva colunas e impede fórmulas injetadas',()=>{
  const c=core.buildCae(record());c.valores[3]='=FORMULA()\tsegunda\nlinha';
  assert.equal(core.controlTsv(c).split('\t').length,17);
  assert.ok(core.controlTsv(c).includes("'=FORMULA() segunda linha"));
  assert.ok(!core.controlTsv(c).includes('\n'));
  c.valores[3]='"><img src=x onerror=x>';
  assert.ok(!core.renderControl(c).includes('<img'));
});
test('restringe consultas à área pública da UFBA',()=>{
  assert.equal(core.safeURL('/public/jsp/portal.jsf'),'https://sipac.ufba.br/public/jsp/portal.jsf');
  for(const u of ['https://evil.test/a','http://sipac.ufba.br/public/a','https://sipac.ufba.br/login','//evil.test/public/a','https://user@sipac.ufba.br/public/a'])assert.throws(()=>core.safeURL(u));
});
test('gera nomes de arquivo sem separadores de caminho',()=>{
  assert.equal(core.slug('OFÍCIO / Currículo'),'oficio_curriculo');
  assert.ok(!core.slug('../../../../').includes('/'));
});
test('valida magic bytes de PDFs e identifica HTML',()=>{
  assert.equal(core.extension({bytes:utf8.encode('%PDF-1.7\n'),type:'application/download'}),'pdf');
  assert.equal(core.extension({bytes:utf8.encode('<!doctype html><html>'),type:'text/html'}),'html');
  assert.throws(()=>core.extension({bytes:new Uint8Array(),type:'application/pdf'}));
  assert.throws(()=>core.extension({bytes:utf8.encode('falha'),type:'application/download',disposition:'attachment; filename="falso.pdf"'}));
});
test('CRC32 tem o resultado de referência',()=>assert.equal(core.crc32(utf8.encode('123456789')),0xcbf43926));
test('ZIP preserva conteúdo binário e nomes UTF-8',async()=>{
  const data=new Uint8Array([0,255,128,12,9]);
  const bytes=new Uint8Array(await core.makeZip([{name:'documentos/ação.pdf',bytes:data}]).arrayBuffer());
  const view=new DataView(bytes.buffer),nameSize=view.getUint16(26,true);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint16(6,true),0x0800);
  assert.equal(new TextDecoder().decode(bytes.slice(30,30+nameSize)),'documentos/ação.pdf');
  assert.deepEqual(bytes.slice(30+nameSize,30+nameSize+data.length),data);
  assert.equal(view.getUint32(14,true),core.crc32(data));
  assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
  assert.equal(view.getUint16(bytes.length-12,true),1);
});
test('ZIP rejeita caminhos que escapam da pasta',()=>{
  for(const name of ['../senha','/absoluto','pasta/../fora','pasta\\arquivo','pasta//arquivo'])assert.throws(()=>core.makeZip([{name,bytes:utf8.encode('x')} ]));
});
function record(){return {processo:'23066.026112/2026-79',consultado_em:'2026-11-15',fonte:'https://sipac.ufba.br/public/jsp/portal.jsf',total_salvo:1,total_listado:1,cabecalho:{Assunto:'Currículo <script>alert(1)</script>'},interessados:{colunas:[],linhas:[]},movimentacoes:{colunas:[],linhas:[]},documentos:[{ordem:1,tipo:'OFICIO',descricao:'=COMANDO()',data:'15/11/2026',origem:'UFBA',natureza:'OSTENSIVO',status:'baixado',arquivos:[{caminho:'documentos/001.pdf',variante:'original',formato:'pdf'}],avisos:[],erros:[]}]};}
test('índice escapa conteúdo do portal e preserva links locais',()=>{
  const html=core.report(record());assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('href="documentos/001.pdf"'));
});
test('CSV impede interpretação da descrição como fórmula',()=>assert.ok(core.csv(record()).includes("'=COMANDO()")));
