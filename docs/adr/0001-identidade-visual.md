# ADR 0001: identidade visual "Mesa posta"

- **Status:** aceita
- **Data:** 2026-10-05
- **Contexto completo:** [`docs/design-research.md`](../design-research.md), com as referências, as três direções e as paletas
  conferidas com `culori`.

## Contexto

O front tinha uma base visual provisória: matiz 265 (azul), `system-ui` e um favicon de dois círculos. A landing da lista
de espera é o primeiro contato com o produto, um app de encontros entre adultos por experiências e minijogos. Ele pede a
alguém que jogue com um desconhecido, então o risco principal é de confiança; o lúdico precisa aparecer sem infantilizar.
Antes do lançamento não há fotos de pessoas, número de usuários nem depoimentos para mostrar.

Alternativas avaliadas (seção 2 da pesquisa):

| | A. Mesa posta | B. Parquinho adulto | C. Fliperama suave |
|---|---|---|---|
| Ideia | Convite para uma noite a dois, luz de vela, serifa expressiva | Colagem de papel recortado, adesivos, cor forte | Sala de jogos à noite, gradiente e menta de neon |
| Fontes | Fraunces + Hanken Grotesk | Bricolage Grotesque + Figtree | Unbounded + Onest |
| Paleta | Ameixa, damasco, rosa-chá; escuro padrão | Creme, violeta, lima, coral; claro padrão | Índigo, violeta, magenta, menta; escuro padrão |
| Prós | Sinal adulto e de confiança forte; ameixa com damasco está livre no nicho; imagem barata (natureza-morta, sem rostos) | Sinal lúdico forte; ótima em ilustração de jogos | Lúdico imediato; combina com as salas de jogo |
| Contras | Pode ficar sério demais; parentesco com o 222 (escuro + serifa creme) | Precisa de um sistema de ilustração que um projeto solo teria de manter; perto de Meetup e Bumble | Cara de Discord, Twitch e Gartic; sinal adulto fraco |

## Decisão

Adotamos a **direção A, "Mesa posta"**:

- **Tipografia:** Fraunces (variável, eixo `opsz`) nos títulos e Hanken Grotesk (variável) no texto e na UI, servidas pelo
  próprio site via `@fontsource-variable/*` (OFL 1.1), sem chamada a terceiros.
- **Cor:** tons crus em OKLCH (`plum`, `cream`, `apricot`, `rose`, `danger`) e tokens semânticos com os dois temas em
  `light-dark(claro, escuro)`, dentro de `@theme inline`. Escuro primeiro (`color-scheme: dark light`), seguindo a
  preferência do sistema; um botão fixa o tema em `data-theme` e o guarda no `localStorage`.
- **Seções noturnas:** hero, bloco do minijogo, segurança e chamada final forçam `scheme-dark` nos dois temas, com foto,
  véu de ameixa entre 40 e 70% e grão de filme. Sem a foto, fica o gradiente `candlelight`.
- **Logo:** wordmark "duora" em minúsculas, com as letras do Fraunces (600, opsz 144, SOFT 50) convertidas em contorno
  SVG, e o "o" como dois anéis entrelaçados em lente, damasco e rosa-chá: duas pessoas que se encontram. O favicon e o
  `apple-touch-icon` são só a lente. No hover, os anéis se afastam e voltam, só com `prefers-reduced-motion:
  no-preference`.
- **Tom:** íntimo e seco, frases curtas, minúsculas no título. Nada de número de lista nem depoimento inventado; o
  minijogo de 20 s aparece como "em breve".
- **Imagens:** natureza-morta gerada por IA, sem pessoas e sem texto, pela API do Tripo (text-to-image). Hero, segurança
  e minijogo vieram do GPT Image 2.5 (`chat_image_2.5_flare`); mesa com os cavalos, passos de "como funciona" e FAQ, do
  Nano Banana Pro (`banana_pro`).

Por quê: o público é adulto e o risco é confiança, então a estética passa segurança e o lúdico entra pelo conteúdo (a
frase interativa do hero e, depois, o minijogo). A paleta diferencia o Duora do roxo e magenta de jogo, e as imagens sem
rosto são baratas de manter consistentes.

## Consequências

- **Bom:** um único lugar define cor e tema (`src/index.css`); as seções noturnas reaproveitam os mesmos tokens só trocando
  o `color-scheme`; o logo não espera fonte.
- **Custo:** o risco de "sério demais" fica com a microcopy e a frase interativa até o minijogo existir. O parentesco com
  o 222 é mitigado pelo matiz (ameixa em vez de verde), pela Fraunces e pelo formulário visível na primeira dobra.
- **Navegadores:** `light-dark()` nativo exige Chrome 123, Firefox 120 e Safari 17.5. No build, o Lightning CSS do
  Tailwind troca a função por variáveis (`--lightningcss-light/dark`) para os navegadores-alvo do Tailwind (Safari 16.4+).
  Esse polyfill só funciona porque os tokens estão em `@theme inline`: cada classe recebe o próprio `light-dark()` e o
  resolve no elemento. Voltar os tokens para `@theme` comum quebraria as seções noturnas no tema claro.
- **Peso:** duas fontes variáveis (~100 KB em latin) e cerca de 580 KB de imagens WebP; só a do hero carrega cedo
  (`fetchpriority="high"`), o resto é `loading="lazy"`.
- **Depois:** a paleta C pode virar o tema das salas de jogo dentro do app, onde o clima de fliperama ajuda.

## Compliance

- `src/app/theme.test.ts` lê os tokens do `index.css` e mede, nos dois temas, cada par que os componentes desenham:
  4,5:1 para texto, 3:1 para texto grande, borda e foco. Os pares das seções noturnas são medidos só no lado escuro, que é
  o único que elas usam. O teste falha se um par violar o limite, se um componente usar tom cru ou se um token semântico
  novo ficar sem par.
- O mesmo teste confere que toda cor cabe no sRGB, que o anel de foco é único e que o movimento reduzido desliga
  animações.
- `src/app/favicon.test.ts` confere que o favicon pinta só tons do `index.css` e que o `apple-touch-icon` existe e está
  declarado.
- O contraste do texto sobre as fotos foi medido no navegador (1280 e 390 px, texto escondido, 5º percentil dos pixels
  sob cada caixa de texto) e ficou acima de 4,5:1 para texto e 3:1 para títulos. Trocar uma imagem pede repetir essa
  conferência.
