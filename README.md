# OTTOS Construtora — estrutura do projeto

## Pastas
- `index.html`: homepage.
- `pages/`: páginas internas. A galeria já está em `pages/galeria.html`; futuras páginas (empresa, serviços, blog etc.) devem entrar aqui.
- `assets/css/main.css`: estilos globais e responsivos.
- `assets/js/main.js`: interações, GSAP, scroll, menu, header e slideshow.
- `assets/images/brand/`: marca OTTOS.
- `assets/images/projects/`: fotografias de projetos, renomeadas de forma descritiva para organização e SEO.
- `assets/images/seo/`: imagens para compartilhamento/social.
- `assets/icons/`: ícones vetorizados em SVG a partir dos arquivos fornecidos.

## SEO antes da publicação
O site já possui title, description, Open Graph, Twitter Card, dados estruturados Schema.org, geolocalização de Uberlândia/MG, hierarquia semântica e alt texts.

Antes de publicar, substitua os contatos provisórios e confirme o domínio definitivo. Depois, prefira trocar os `canonical` e URLs de Open Graph por URLs absolutas do domínio de produção e gerar um `sitemap.xml` com todas as páginas definitivas.


## v10 — correção do slideshow da hero

O slideshow da hero passou a ser controlado inteiramente por CSS, sem `setInterval`. Isso elimina a condição anterior que desativava o slideshow quando `prefers-reduced-motion` estava ativo e também reduz a dependência de timers JavaScript. As 11 imagens fazem crossfade contínuo a cada 6,5 segundos.
