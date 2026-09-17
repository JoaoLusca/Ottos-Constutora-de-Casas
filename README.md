# OTTOS Construtora — site institucional

## Estrutura
- `index.html`: Home.
- `pages/galeria.html`: página interna de galeria.
- `assets/css/main.css`: estilos globais e responsivos.
- `assets/js/main.js`: menu, headers, slideshow, scroll e interações leves.
- `assets/images/`: identidade, projetos e imagens de SEO.
- `assets/icons/`: ícones SVG.

## Padrão obrigatório para páginas internas
Todas as páginas internas devem utilizar o mesmo shell visual da Home:
1. `site-header-top`;
2. `site-header-float`;
3. `mobile-menu`;
4. conteúdo dentro de `#app`;
5. footer global;
6. botão flutuante de WhatsApp.

A página `pages/galeria.html` já serve como referência desse padrão. Em novas páginas, devem mudar apenas o conteúdo de `<main>`, SEO específico da página e os caminhos relativos necessários.

## Interações
O projeto usa APIs nativas do navegador para as animações essenciais. O smooth scroll desktop é uma melhoria progressiva: se a biblioteca externa não carregar, o site continua totalmente funcional com rolagem nativa.


## v14
- Corrigido o styling da hero da página Galeria em desktop e mobile.
- Footer compartilhado ficou mais compacto verticalmente, preservando conteúdo e identidade visual.
