const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./collector.js');
const utf8 = new TextEncoder();

test('aceita NUP completo e rejeita entradas incompletas',()=>{
  assert.equal(core.number('23066026112202679'),'23066.026112/2026-79');
  assert.equal(core.number(' 23066.026112/2026-79 '),'23066.026112/2026-79');
  for(const n of ['026112','23066.026112/2026','../arquivo','<script>',''])assert.throws(()=>core.number(n));
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
