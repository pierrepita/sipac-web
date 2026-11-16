"use strict";
const $ = id => document.getElementById(id);
let bookmarkURL = "";
function normalize(value) {
  value = value.trim();
  if (/^\d{17}$/.test(value)) value = value.slice(0,5)+"."+value.slice(5,11)+"/"+value.slice(11,15)+"-"+value.slice(15);
  if (!/^\d{5}\.\d{6}\/\d{4}-\d{2}$/.test(value)) throw new Error("Informe o número completo, como 23066.026112/2026-79.");
  return value;
}
(async () => {
  try {
    const response = await fetch("./collector.js", {cache:"no-cache"});
    if (!response.ok) throw new Error("Não foi possível preparar o favorito. Recarregue a página.");
    const source = await response.text();
    if (!source.includes("SipacWebCore")) throw new Error("O código do favorito não foi reconhecido.");
    bookmarkURL = "javascript:" + encodeURIComponent(source);
    $("bookmark").href = bookmarkURL;
    $("bookmark").removeAttribute("aria-disabled");
    $("bookmark-text").value = bookmarkURL;
    $("bookmark-status").textContent = "Arraste “Baixar SIPAC” para a barra. Depois use o passo 2.";
    $("open").disabled = false;
    $("copy").disabled = false;
  } catch (error) { $("bookmark-status").textContent = error.message; }
})();
$("bookmark").addEventListener("click", event => {
  event.preventDefault();
  $("bookmark-status").textContent = "Este botão deve ser arrastado para a barra de favoritos. Depois, clique no favorito na aba do SIPAC.";
});
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(bookmarkURL);
    $("copy").textContent = "Copiado! Cole no endereço de um favorito.";
  } catch {
    $("bookmark-text").hidden = false;
    $("bookmark-text").focus();
    $("bookmark-text").select();
    $("copy").textContent = "Selecione e copie o endereço abaixo";
  }
});
$("process-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const process = normalize($("number").value);
    $("number").value = process;
    const target = "https://sipac.ufba.br/public/jsp/portal.jsf#sipac-web="+encodeURIComponent(process);
    const tab = window.open(target,"_blank","noopener,noreferrer");
    $("form-message").textContent = "Na nova aba do SIPAC, clique no favorito “Baixar SIPAC”. Se a aba não abriu, permita a abertura de janelas para este site.";
  } catch (error) { $("form-message").textContent = error.message; $("number").focus(); }
});
