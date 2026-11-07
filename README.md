# Biblioteca Digital Imersiva — V5.2 (correção de renderização)

Esta versão corrige condições de concorrência na renderização de páginas com PDF.js,
serializa tarefas gráficas, limita imagens excessivamente grandes e mostra detalhes
úteis quando houver erro. Preserva os livros e diários salvos no mesmo navegador.

**Instalação:** substitua todos os arquivos do site pelos deste pacote e faça
uma atualização forçada (Ctrl+F5) no navegador. Mantenha os cinco arquivos JS/HTML/CSS
na mesma pasta. Não limpe os dados do site, pois a biblioteca local usa IndexedDB.

**Atenção:** não foi possível executar teste completo da interface em navegador
neste ambiente. Se o erro persistir, registre a mensagem detalhada e o modo de leitura
para identificar problemas específicos do PDF ou do navegador.

# Biblioteca Digital Imersiva — versão 4.0

## Instalação
Coloque `index.html`, `styles.css`, `app.js` e `reader-v4.js` na mesma pasta. Abra `index.html` em um navegador atual ou publique os arquivos em GitHub Pages. O leitor requer conexão com a internet para carregar **PDF.js** (3.11.174) e **pdf-lib** (1.17.1) de CDN.

## Funcionalidades
- Galeria, categorias, busca, capas 9:16 e 16:9 e cadastro de arquivos PDF.
- Ao abrir um livro, escolha entre seis modos: **Livro realista**, **Leitor interativo**, **Apresentação**, **Leitura contínua**, **Noturno** e **Visão panorâmica**.
- O botão **▤ Notas** abre o diário de leitura com anotações associadas às páginas. Salve cada anotação e navegue até sua página pelo botão **Ir**.
- O botão **✎ Destacar** abre a paleta de quatro cores. Com o botão ativo, arraste sobre uma área da página para criar o destaque. A marcação é por coordenadas e funciona em PDFs escaneados ou com texto. Um duplo clique sobre uma marcação, com a ferramenta ativa, permite excluí-la.
- **⇩ PDF anotado** exporta uma cópia com retângulos de destaque incorporados visualmente às páginas e com as anotações textuais em páginas adicionais ao final do PDF. O arquivo original não é modificado.
- O último número de página, os destaques e as anotações ficam salvos no navegador (IndexedDB) pelo ID do livro.

## Importante
- **Não é um backend multiusuário.** Os dados ficam neste navegador/dispositivo. Para compartilhar o acervo e sincronizar anotações por estudante, será necessário backend, autenticação e regras de acesso (por exemplo, Supabase).
- Não há OCR ou pesquisa textual garantida em PDFs feitos apenas de imagens. As marcações não são seleção de palavras, mas retângulos desenhados sobre a página. A exportação achata esses retângulos no conteúdo visual do PDF; o leitor que receber o arquivo não poderá editá-los como anotações nativas.
- O **modo noturno** ajusta a interface e o brilho do conteúdo exibido, sem alterar permanentemente o PDF.
- A exportação adiciona notas ao fim do documento; não escreve texto livre por cima de cada página, para preservar o conteúdo e evitar sobreposição.
- Alguns PDFs protegidos por senha, com restrições ou rotações especiais podem não permitir a exportação ou exigir aprimoramentos adicionais.
- Evite usar informações sensíveis no armazenamento local de computadores compartilhados. O botão de baixar PDF original respeita a opção de download; o botão de exportar a versão anotada está disponível ao leitor nesta versão.
- Para cargas grandes, o modo contínuo pode ficar mais lento porque renderiza as páginas sequencialmente.

## Atualização da versão anterior
Substitua `index.html`, `styles.css` e `app.js` e acrescente `reader-v4.js`. A versão do banco IndexedDB é atualizada sem excluir o cadastro de livros já existente no mesmo endereço de origem.


## Versão 5.0 — transferência manual dos Diários de Leitura

Na barra de ferramentas do leitor, abra **Notas**. No final do painel estão os botões **Exportar Diário**, **Importar Diário** e **Backup Geral**.

- **Exportar Diário:** baixa um `.json` com os registros do livro aberto.
- **Importar Diário:** seleciona JSON de um único livro ou de um backup geral; escolha **Mesclar** ou **Substituir** e confirme a operação.
- **Backup Geral:** baixa todos os diários salvos neste navegador, sem incluir os PDFs ou capas.

**Identificação entre dispositivos:** para importar um diário individual, o livro aberto deve possuir o mesmo ID. Se o livro tiver outro ID no dispositivo de destino, o importador pode associá-lo automaticamente somente quando houver uma correspondência única de título, autor, nome e tamanho do PDF. Caso contrário, mantenha os mesmos IDs ou importe no dispositivo original. PDFs e capas não são incluídos no backup.

**Cuidados:** mantenha um arquivo de backup antes de substituir registros. Importar é uma transferência **manual**, não uma sincronização automática entre dispositivos. Os arquivos JSON contêm suas reflexões e devem ser guardados com privacidade.

Compatibilidade: backups JSON gerados por esta V5.0. Os diários da V4.0 continuam guardados no IndexedDB local.


## V5.1 — Gerar minha cópia

A barra do leitor ganhou **Gerar minha cópia**. Escolha Livro Anotado ou Portfólio e Baixar PDF, Baixar DOCX ou Criar cópia na biblioteca. O arquivo PDF original fica inalterado; as cópias na galeria são PDFs locais separados.

DOCX gerado via biblioteca docx (CDN): requer conexão à internet no primeiro acesso. Livro DOCX preserva as páginas como imagens (não como texto editável); notas e reflexões são editáveis. PDF de portfólio lista notas e referências por página para as marcações; não extrai texto de PDFs-imagem. A composição de DOCX grande pode consumir bastante memória. As cópias salvas na biblioteca usam o IndexedDB deste navegador e não são publicadas para outros usuários.
