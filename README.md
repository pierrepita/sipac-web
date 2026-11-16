# SIPAC Web — UFBA

Versão inteiramente estática para **GitHub Pages**, com um favorito automatizador que executa a coleta dentro da aba do SIPAC. Não utiliza servidor externo, Python, GitHub Actions como serviço de consulta ou conta do GitHub de quem vai usar.

**Acesse o site: [pierrepita.github.io/sipac-web](https://pierrepita.github.io/sipac-web/)**

## Número do processo e planilha de controle CAE

Aceita **23066.006904/2023-84**, **006904/23-84** ou os 17 dígitos do NUP. Na forma curta, o prefixo é **23066 (UFBA)** e o ano é **20xx**; para outro século ou prefixo, use o número completo. Zeros à esquerda são preservados.

Após a consulta, use **Copiar linha para planilha**. O texto tem uma única linha separada por tabulações, sem cabeçalho: cole na coluna **Processo** de uma linha vazia no Excel, LibreOffice ou Google Sheets. **Revisar os 17 campos** permite alterar os valores antes de copiar; **Copiar cabeçalhos** fornece a ordem das colunas.

A ordem é: Processo, Nível, Unidade de Origem, Título, Relator, Tipo, Sugestão de prazo, Data Abertura, Data Recebimento, Data Distribuição, Data Parecer, Dias até Parecer, Data Apreciação, Situação, Parecer, Final e OBS.

O preenchimento inicial utiliza:

- **Processo:** forma reduzida da UFBA quando o ano é 20xx; mantém a forma completa em outros casos.
- **Título e Unidade de Origem:** cabeçalho do SIPAC. Unidades identificadas como FMB são agrupadas como **FMB - Faculdade de Medicina**. O título reproduz o assunto cadastrado e pode ser resumido manualmente.
- **Nível e Tipo:** sugestões conservadoras por palavras do assunto. Nível: PÓS quando há indicação de pós-graduação, residência, especialização, mestrado ou doutorado; GRAD quando há graduação sem indicação de pós. Tipo: Criação de curso ou Alteração curricular quando explícitos; nos demais casos, A definir. Revise essas sugestões.
- **Data Abertura:** data de abertura/autuação, com cadastro como alternativa. Horários são removidos.
- **Data Recebimento:** recebimento válido mais recente em uma movimentação cujo **destino é o CAE**. Não usa a data de envio nem uma saída do CAE. Sem evidência, A definir.
- **Sugestão de prazo:** 30 dias, valor inicial editável, sem atribuir esse prazo a uma norma.
- **Situação:** Em análise como estado inicial da planilha, sem reproduzir ou inferir a situação atual no CAE.
- **Demais campos e dados ausentes:** A definir. Não inventa relator, datas de distribuição/parecer/apreciação, resultado, decisão final ou observações; não calcula Dias até Parecer.

A seção **Como os campos foram preenchidos** mostra as fontes e as sugestões. A revisão vale para a linha copiada na página. A pasta/ZIP também inclui **controle-cae.tsv** (cabeçalho e linha inicial) e **controle-cae.js** (botões do índice offline). O TSV permanece com o preenchimento inicial.

Se a cópia automática for bloqueada pelo navegador, aparece uma caixa com o texto selecionado para copiar manualmente. As tabulações e quebras de linha dentro de campos são substituídas por espaços; valores que poderiam ser interpretados como fórmulas são protegidos.


## Como usar

1. Abra o site publicado no GitHub Pages.
2. **Uma única vez:** arraste o botão **Baixar SIPAC** para a barra de favoritos do navegador.
3. Informe o número completo ou reduzido do processo e clique em **Abrir SIPAC**.
4. Na nova aba do SIPAC, clique no favorito **Baixar SIPAC**.
5. Aguarde a coleta e clique em **Baixar ZIP do processo** no painel.
6. Extraia o ZIP no computador e abra **`indice.html`**.

No Chrome e Edge, `Ctrl+Shift+B` mostra a barra de favoritos; no macOS, use `⌘+Shift+B`. A página oferece também a cópia do endereço do favorito para adicionar manualmente.

Você também pode abrir a consulta pública do SIPAC diretamente e clicar no favorito. Nesse caso, ele solicita o número do processo em uma caixa de entrada.

## Por que existe um favorito?

O GitHub Pages serve HTML, CSS e JavaScript. O SIPAC/UFBA não fornece os cabeçalhos CORS necessários para uma página de outro domínio ler suas respostas diretamente. Portanto, um `github.io` isolado não consegue fazer a coleta automática pela interface de outro site.

O favorito é um **bookmarklet**: um pequeno programa JavaScript salvo como favorito. Quando a pessoa o ativa na aba do SIPAC, o código executa as consultas na mesma origem do portal e prepara os arquivos no próprio navegador. A página do GitHub apenas fornece o código e orienta o fluxo.

Essa etapa adicional é parte da solução. **Não é uma consulta automática inteiramente dentro da página `github.io`.** A pessoa precisa adicionar o favorito e ativá-lo na aba do SIPAC. Não é necessário desabilitar CORS, instalar extensões ou alterar configurações de segurança.

## O que fica no ZIP

| Caminho | Conteúdo |
| --- | --- |
| `indice.html` | Cabeçalho, interessados, descrições, links locais, movimentações e pendências |
| `documentos/` | Arquivos originais, versões com informações de assinatura, cópias HTML dos documentos eletrônicos e seus metadados |
| `processo.json` | Dados estruturados e inventário com hashes SHA-256 dos arquivos de conteúdo |
| `documentos.csv` | Inventário para abrir em uma planilha |

Mantenha o índice e a pasta `documentos` juntos. Os links são relativos; mover a pasta inteira preserva os vínculos. O download é um ZIP sem compressão para evitar bibliotecas externas e trabalho extra de processamento. PDFs já são normalmente compactados.

As descrições vêm do campo **Assunto Detalhado** do documento; quando ele não existe, é usado seu tipo. Os PDFs são preservados com os bytes recebidos do SIPAC. Documentos digitados no portal recebem uma cópia HTML passiva, com o texto e as informações de assinatura exibidas. A cópia não acrescenta uma assinatura digital ao arquivo.

## Privacidade e alcance

- O código e a página ficam no GitHub. Os documentos são consultados no SIPAC e preparados em memória no navegador; não são enviados ao GitHub nem publicados no repositório.
- A ferramenta aceita somente endereços HTTPS na área `/public/` de `sipac.ufba.br`.
- São utilizadas as permissões que o próprio SIPAC concede à aba em que a pessoa ativou o favorito. Não são solicitadas credenciais pela ferramenta.
- Itens listados sem conteúdo acessível ficam registrados como restritos ou indisponíveis. Itens totalmente ocultos não podem ser identificados.
- Falhas temporárias recebem tentativas limitadas. Se apenas uma versão de um documento for obtida, o item fica como parcial.
- Mantenha a aba aberta até aparecer o botão para baixar o ZIP.

## Limitações

- Desenvolvido para navegadores de computador. Dispositivos móveis podem dificultar a criação e a ativação de favoritos com JavaScript.
- Políticas institucionais, extensões e mudanças na política de segurança do SIPAC podem bloquear bookmarklets. A ferramenta não desativa essas proteções.
- Mudanças no layout do portal podem exigir atualização do coletor.
- O limite é de **64 MB por resposta** e **180 MB para os arquivos do pacote**. O navegador precisa de memória livre para preparar o ZIP. Arquivos grandes podem exigir a versão Python ou o download manual pelo SIPAC.
- Não existe retomada automática depois de fechar ou cancelar a aba.
- O favorito inclui uma cópia do código. Depois de uma atualização do programa, adicione-o novamente para receber a nova versão.
- O site não acompanha novas juntadas automaticamente.

## Publicar no GitHub Pages

1. Crie um repositório público com estes arquivos na raiz.
2. Em **Settings → Pages**, selecione **Deploy from a branch**.
3. Escolha a branch **main**, pasta **`/ (root)`**, e salve.
4. Aguarde a publicação e use o endereço informado pelo GitHub.

O arquivo `.nojekyll` mantém a publicação estática. Não são necessárias chaves, tokens, variáveis de ambiente ou serviços de coleta externos.

## Código e testes

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Página de orientação, geração do favorito e abertura da consulta |
| `collector.js` | Consulta JSF, coleta, índice, sanitização de HTML e criação do ZIP |
| `test-collector.cjs` | Testes offline do núcleo e do pacote ZIP |

Para executar os testes de desenvolvimento, com Node.js 20 ou superior:

```bash
node --test test-collector.cjs
```

A integração com respostas sintéticas pode ser verificada abrindo `tests/integration.html` em um servidor estático local, por exemplo `python3 -m http.server 8000`. Clique em **Executar testes de integração**: o resultado esperado é **PASSOU**, com três documentos listados, dois acessíveis e onze entradas no ZIP. O teste não consulta o SIPAC.

Quem usa o site não precisa instalar Node.js. O coletor não tem dependências externas. O repositório original da versão Python está em [pierrepita/sipac-local](https://github.com/pierrepita/sipac-local).
