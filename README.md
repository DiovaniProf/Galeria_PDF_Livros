# Biblioteca Digital Imersiva — V1.0

Site estático em HTML, CSS e JavaScript com galeria, upload de PDFs e capas, edição, exclusão e leitor de PDFs com efeito de folhear páginas.

## Como executar

1. Descompacte o ZIP.
2. Abra `index.html` em um navegador moderno. Para resultados consistentes, use um servidor HTTP local (ex.: VS Code Live Server ou `python -m http.server 8000`) e acesse `http://localhost:8000`.
3. Clique em **Gerar livro**, preencha os dados e selecione um PDF e uma capa opcional.
4. Clique em **Publicar na biblioteca**, depois em **Ler livro**.

## Publicação no GitHub Pages

Envie `index.html`, `styles.css` e `app.js` para a raiz do repositório e ative **Settings → Pages → Deploy from a branch**. O arquivo README.md é opcional.

**Importante:** nesta versão os livros enviados ficam em **IndexedDB no navegador e dispositivo do usuário**, não no GitHub nem em um servidor. Logo, um livro cadastrado no seu computador **não aparecerá automaticamente para estudantes** que acessarem a página por outro dispositivo. Limpar os dados do site ou usar outro perfil/navegador pode remover os livros. Para um acervo compartilhado e persistente, a próxima versão precisará de backend/armazenamento externo (ex.: Supabase Storage + autenticação e políticas de acesso). Não use esta versão como backup exclusivo de arquivos importantes.

## Requisitos e limitações

- Usa **PDF.js 3.11.174**, carregado pela CDN cdnjs. **É necessária conexão com a internet** para o leitor funcionar. A interface e o cadastro são locais.
- Recomendado PDF de até 80 MB por arquivo (o limite de armazenamento do navegador pode ser menor ou maior).
- PDFs protegidos por senha não são suportados neste protótipo.
- Capa aceita JPG, PNG e WebP, de preferência vertical 2:3.
- O livro é apresentado por renderização do PDF: **não modifica nem converte o arquivo original**; não é um editor de PDF.
- O efeito de folheamento é uma animação CSS de transição entre páginas, com duas páginas no desktop e uma em telas pequenas; não é uma simulação física completa de dobra de papel.
- Os controles de edição/exclusão são locais e não possuem login nesta versão.
- Para produção, considere processamento controlado, políticas de uploads e proteção contra arquivos maliciosos.

## Arquivos

- `index.html`: estrutura das telas
- `styles.css`: identidade visual e responsividade
- `app.js`: cadastro, IndexedDB, galeria, PDF.js, navegação e efeito de folheamento

© Projeto demonstrativo educacional.


## Alterações V2.0
- Tipografia ampliada em toda a plataforma e controles, incluindo telas pequenas.
- Proporção da capa selecionável: 9:16 (vertical) ou 16:9 (horizontal).
- Proporção salva em cada registro do IndexedDB, preservada durante edição e refletida na galeria e na prévia.
- Imagens da capa são exibidas por completo (object-fit: contain, sem recortes).
- Categoria obrigatoriamente escolhida em lista suspensa com 23 opções alfabéticas (Cinema sem duplicação, Música corrigida).
- Livros cadastrados na V1 permanecem disponíveis na V2 no mesmo domínio e navegador; adotam capa vertical 9:16 se editados sem formato anterior.
