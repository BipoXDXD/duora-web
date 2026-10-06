# Duora: pesquisa de referências visuais e três direções de design

Data da pesquisa: 5 de outubro de 2026. Escopo: landing com inscrição na waitlist, mais as telas desktop e mobile do app.

## 0. Método e limites

Como cada dado foi obtido:

- **Fonte tipográfica:** lida no CSS (`font-family`, `@font-face`) ou em `getComputedStyle` e `document.fonts` no navegador (Playwright, 1440x900). Onde o site usa fonte proprietária, registro o nome do arquivo ou da família e não afirmo o fornecedor sem prova.
- **Cores:** hex e OKLCH lidos do CSS ou do estilo computado. Onde só vi a cor na captura de tela, digo "visual".
- **Estrutura e tom:** lidos no `innerText` da página e nas capturas do hero. Só descrevo seções que vi; o resto aparece como "não verificado".

O que não deu certo (para o leitor não tomar lacuna por ausência):

| Alvo | Resultado |
|---|---|
| Lex | `lex.social` é um domínio estacionado; não achei o site oficial do app. A análise vem do estudo de caso da &Walsh (andwalsh.com) e de matérias. Fonte e hex **não verificados**. |
| Pie | `pie.app` redireciona para um leilão de domínio e `pie.co` redireciona para `httpie.io`. Sem site para analisar; só dados do produto (TechCrunch, App Store). |
| Gartic | `gartic.io` devolve 403. Analisei o **Gartic Phone** (`garticphone.com`), que tem proposta mais próxima (jogo social casual). |
| Among Us | O jogo não tem landing própria; analisei o site da Innersloth, página do jogo. |
| Galerias (Land-book, Godly, SaaS Landing Page) | Land-book abriu, mas a primeira página só trazia sites de agência, B2B e e-commerce, sem produto social. `godly.website` redireciona para `recent.design`, onde não achei produto social comparável. SaaS Landing Page não lista consumer apps nos artigos que li. **Não consegui confirmar que os três destaques abaixo estejam nessas galerias.** Escolhi Partiful, Duolingo e 222 por julgamento próprio, por serem os de identidade mais marcante e relevante para o Duora. |
| Bumble BFF | Analisei `bumble.com/en/bff` (a página da home só pela leitura do HTML). |

A maioria dos sites exibia banner de cookies na captura; descrevo o conteúdo por trás.

---

## 1. Referências

### 1.1 Timeleft (timeleft.com)

- **Tipografia:** título em **Feature Deck Medium** (nome do arquivo `FeatureDeck-Medium.woff2`; serifada de alto contraste, 72 px, espaçamento entre letras bem fechado). Corpo em **Fixel Text** (Regular e SemiBold). Nenhuma das duas consta no Fontsource (conferido pela API); no Google Fonts não verifiquei.
- **Paleta e tema:** claro e quente. Fundo `#f7f3ed` (creme), texto `#111`, laranja `#f97709`, rosa `#ff83de` e `#f94ea0`, amarelo `#fcd933`, pêssego `#ffd8c8`. CTA principal é pílula com gradiente rosa para pêssego.
- **Imagem:** fotografia candid de pessoas rindo num bar, hero em tela cheia com texto branco por cima. Ícones simples nas etapas; mapa (Leaflet) de cidades.
- **Estrutura:** nav (About, Newsroom, Locations, Log in, Sign up) → hero com cidade detectada, H1, "Find your group" e botões das lojas → número de prova social (4M+ members) → "How it works" em 3 passos → quiz de personalidade → 3 cards de atividade (jantares, drinks, corridas) → mapa (52 países, 200+ cidades) → depoimentos (Trustpilot, App Store) → FAQ → CTA final.
- **Logo:** wordmark manuscrito em minúsculas, branco sobre foto; um par de "olhos" (dois círculos) funciona como mascote e aparece depois do H1.
- **Tom:** direto e acolhedor, frases curtas em imperativo. "No bios. No swiping. No planning." "Show up and settle in". Tira o medo ("walk in knowing everyone chose to be there, too").

### 1.2 Thursday (thursday.com)

- **Tipografia:** títulos em **Barlow Condensed 900**, caixa alta (carregada no navegador; também há Anton, Bayon, Lato, DM Sans no CSS). Corpo em **Inter** 500 e 700. Todas livres.
- **Paleta e tema:** escuro. Fundo `#121212` e `#151515`, rosa `#FBAAD2`, lavanda `#ACA1FF` (e lavanda a 14% de opacidade em chips), textos brancos com opacidade 50 a 90%.
- **Imagem:** retrato fotográfico em tela cheia, escurecido, com ar editorial/underground. Nos cards de evento, o texto extraído traz só título, local, preço e data; não vi imagem neles.
- **Estrutura:** hero com foto e H1 ("The biggest IRL dating app in the world") → "Find your city" → missão em um parágrafo → "Selling out around the world" com seletor de cidade e lista de eventos (dia, nome, local, preço, data, "GET TICKETS"). O app de matches foi encerrado e a marca virou eventos.
- **Logo:** wordmark minúsculo arredondado, branco; o `™` aparece no título da aba.
- **Tom:** provocador e irônico. O banner de cookies diz "Cookies? Obviously." Missão: "Less matching. More meeting."

### 1.3 Hinge (hinge.co)

- **Tipografia:** título em **Tiempos Headline** (serifada, 58 px, negrito), corpo e navegação em **Modern Era**; há também Tiempos Text Narrow. Todas comerciais.
- **Paleta e tema:** claro. Fundo `#fffefd`, texto `#1a1a1a`, ameixa `#67295f` e `#d9c9d7` como acentos discretos.
- **Imagem:** foto de casal num parque, hero de tela cheia com luz natural, sem retoque pesado. Vídeo em outras seções.
- **Estrutura:** logo centralizado e nav nas laterais → hero foto + H1 → "como fazemos" (abordagem, algoritmo) → depoimentos de casais → Hinge Labs ("love scientists") → CTAs de missão, vagas e imprensa → rodapé com idiomas.
- **Logo:** wordmark com "H" de barra cruzada marcante; branco sobre foto.
- **Tom:** otimista e pessoal. "The dating app designed to be deleted". "Dating effective, not addictive."

### 1.4 Bumble e Bumble BFF (bumble.com)

- **Tipografia:** **Bumble Sans** (própria, com versão condensada) na home; na página BFF, **Circular 20** (H1 em Black 900, 168 px; corpo em Book). Proprietárias.
- **Paleta e tema:** claro, dominado pelo amarelo `#ffc629` e `#ffdb5b` (BFF usa `rgb(255,222,59)`), com texto cinza-carvão `#444647` e `#141414`. Botão primário amarelo com texto `#141414`.
- **Imagem:** fotografia com máscaras orgânicas (blob), adesivos inclinados ("Bad plant parent") e ilustrações de personagens em estilo adesivo.
- **Estrutura (home):** nav → carrossel de cartões de perfil → missão → tags de interesse → Member Circle → módulos Date e BFF → depoimento → QR code do app → rodapé. A BFF é mais curta: hero amarelo, parágrafo, "Download", assinatura de e-mail, blog.
- **Logo:** hexágono amarelo com três barras mais wordmark minúsculo.
- **Tom:** caloroso e empoderador. "Find your people". "There are friends for every era. Even your messy ones."

### 1.5 Feeld (feeld.co)

- **Tipografia:** família própria **feeld** com variantes `feeld-edge` (200 a 600; H1 de 111 px em peso leve), `feeld-mono`, `feeld-typowriter` e `feeld-analogia`. Proprietária.
- **Paleta e tema:** escuro. Fundo `#090516`, cartões `#181424`, CTA magenta `#E72ABD` com texto `#131313`, textos `#EDEDED`. Seções codificadas por cor: roxo `#652184`, azul `#394acb`, verde `#008c56`, vinho `#630c00`.
- **Imagem:** vídeo e foto íntimos, escuros, quase abstratos; mockups de celular; ícones de linha coloridos por categoria.
- **Estrutura:** hero com H1 que alterna palavras ("A dating app for the throuples", a palavra final desfocada) e "Join a community of 14M+" com avatares → benefícios → segurança → depoimentos → eventos presenciais → revista → CTA.
- **Logo:** "FEELD" em caixa alta, extra-pesada e larga, branca.
- **Tom:** inclusivo e sem julgamento. "Explore your desires in a judgement-free place". "Honesty is everything".

### 1.6 Lex (não verificado no site; fonte: estudo de caso da &Walsh)

- **Tipografia:** não verificada.
- **Paleta e tema:** "Lex Green" como cor principal e paleta "de primavera" (crescimento, energia) no lugar do arco-íris. Claro, texturizado.
- **Imagem:** ilustrações modulares de chamas, flores, estrelas, montanhas e corações, com texturas ásperas e padrões imperfeitos; fotos em molduras de cantos arredondados.
- **Estrutura:** não verificada. Há adesivos físicos e digitais com frases ("sticker lines") para pronomes e interesses.
- **Logo:** lettering personalizado em que cada letra se liga à seguinte ("fluidez e conexão").
- **Tom:** alegre, de "playground queer"; texto primeiro, selfie depois.

### 1.7 222 (222.place)

- **Tipografia:** **Crimson Pro** (serifada, variável 200 a 900, livre) em tudo; `sfPro` só para UI.
- **Paleta e tema:** escuro. Fundo `oklch(0.245 0.0249 154)` (verde-floresta quase preto), pílulas `oklch(0.2903 0.0302 155.67)`, texto creme `oklch(0.9918 0.0415 107)`, texto secundário `oklch(0.7276 0.0328 117)`. Há textura de ruído sutil.
- **Imagem:** nenhuma foto na primeira tela que renderizei (o WebFetch citou molduras polaroid, que **não vi** na renderização). Todo o peso está na tipografia.
- **Estrutura:** uma tela só. Frase interativa no centro, "let us plan [drinks & museum] with your [♡ blind date]", com os trechos em pílulas que alternam; CTA creme "SIGN UP →" em itálico; rodapé mínimo (privacidade e termos). Nav com "contact" e "about".
- **Logo:** pilha de "2" em formato de seixos, creme sobre verde; funciona como favicon.
- **Tom:** minúsculas, "&" no lugar de "and", sussurrado e íntimo. "meet new people, discover your city, & deepen your relationships".

### 1.8 Meetup (meetup.com)

- **Tipografia:** **NeuSans** (Regular, Book, Medium, Bold) para texto e títulos; **Boyrun** (manuscrita) só nos adesivos. Proprietárias.
- **Paleta e tema:** claro. Fundo quase branco, botão escuro `#353538` e `#121215`, teal `#00798a`, rosa `#d63b63`, vermelho `#C80000` para erro; wordmark em coral (visual).
- **Imagem:** recortes de fotos de pessoas sobre formas orgânicas coloridas (blobs lilás, rosa, amarelo), com rótulos manuscritos tipo adesivo ("Perto de você", "Toda quinta-feira") e rabiscos de linha. Ícones emoji-like inline no H1.
- **Estrutura:** barra de busca com cidade → H1 com ícones inline → parágrafo → CTA → carrossel de eventos → categorias → cidades → como funciona (3 passos) → blog → rodapé.
- **Logo:** "m" em quadrado arredondado coral mais wordmark minúsculo.
- **Tom:** acolhedor, foco em pertencimento. "Where interests become friendships".

### 1.9 Raya (raya.app)

- **Tipografia:** **Euclid Circular B** (Regular, Medium, Bold, Light), com Cormorant declarada. Proprietárias.
- **Paleta e tema:** claro, quase vazio. Preto `#000` no botão, cinza `rgb(114,118,120)` no rodapé; o único toque de cor é o gradiente ciano para magenta do logo.
- **Imagem:** nenhuma.
- **Estrutura:** nav mínima (Careers, Contact Us, Press Inquiries) → logo → botão "Apply For Membership" → rodapé legal. Exclusividade por ausência de informação.
- **Logo:** dois círculos entrelaçados em gradiente ciano para magenta, "RAYA" em caixa alta espaçada embaixo.
- **Tom:** quase mudo, verbo de candidatura em vez de "download".

### 1.10 Gartic Phone (garticphone.com)

- **Tipografia:** faces próprias "Black" e "Bold" (arredondadas, extra-pesadas, caixa alta) e fonte de pontos decorativa. Proprietárias.
- **Paleta e tema:** escuro-vibrante. Gradiente vertical roxo para magenta, painéis translúcidos `rgba(41,0,58,.2 a .3)`, menta `rgb(0,255,188)` e `rgb(92,255,182)`, lavanda `rgb(222,216,239)`, texto branco.
- **Imagem:** mascote ilustrado (pássaro roxo com contorno grosso), avatar circular; zero fotografia.
- **Estrutura:** não há landing. Abre direto no lobby: logo, banner "GET THE APP", abas ANONYMOUS e AUTHENTICATED, avatar, apelido sugerido, botão START. "HOW TO PLAY" numerado abaixo.
- **Logo:** adesivo grosso, letras brancas com contorno escuro grosso, disco de telefone no "O"; sombra deslocada.
- **Tom:** direto, imperativo, caixa alta. "THE TELEPHONE GAME".

### 1.11 Among Us / Innersloth (innersloth.com/games/among-us)

- **Tipografia:** **Sofia Pro** (comercial), PT Sans e VCR OSD Mono no CSS; títulos em Sofia Pro semibold, letras espaçadas na barra.
- **Paleta e tema:** barra preta `#1e1e1e` com banner vermelho `#cc1818`; hero em ciano claro com faixa roxa e personagem amarelo.
- **Imagem:** ilustração 2D com contorno marrom grosso; hero com personagem gigante e objetos soltos; recorte curvo na base da seção. Não é 3D.
- **Estrutura:** nav (Games, More, News, About, Merch) → banner de novidade → hero + "Learn more" → botões das lojas (Google Play, App Store, Steam, itch.io, Switch, Xbox, PlayStation) → atualizações → explicação de jogabilidade → rodapé.
- **Logo:** letras desenhadas à mão, brancas com contorno, em formato condensado.
- **Tom:** brincalhão. "Prepare for departure but beware the Impostor!"

### 1.12 Destaques escolhidos por julgamento (galerias não confirmaram)

**Partiful (partiful.com)**
- **Tipografia:** **TWK Lausanne Pan** (850 no H1 de 112 px) e **Partiful Display Medium**. Proprietárias.
- **Paleta e tema:** hero com foto sob um gradiente azul, violeta e rosa com granulação, texto branco; resto claro. Faixa rosa-clara de aviso no topo.
- **Imagem:** foto de festa com gradiente por cima; cartão de convite inclinado sobre a foto, em estilo de adesivo holográfico.
- **Estrutura:** aviso → nav por ocasião (Halloween, Birthdays, Dinners...) → hero com nota "200k+ ratings", H1 "Parties are back", subtítulo e "Create invite" → "Fun, modern invites in 1-click" com amostras de fundos, fontes e animações → carrossel de citações de imprensa → templates em alta → recursos.
- **Logo:** wordmark minúsculo com um "P" estilizado como ícone.
- **Tom:** casual e cheio de emoji. "Evites are so last decade". "Stalk the guest list".

**Duolingo (duolingo.com)**
- **Tipografia:** **duolingo-sans** (700) e **feather**; próprias.
- **Paleta e tema:** claro. Verde vivo na marca e no CTA (visual; não medi o hex), cinza-carvão no título, botão com borda inferior grossa que imita relevo.
- **Imagem:** ilustração vetorial chapada; mascote e vários personagens caindo juntos no hero.
- **Estrutura:** logo → hero com ilustração, H1 e dois botões ("Comece agora", "Já tenho uma conta") → faixa com idiomas.
- **Logo:** coruja-ícone verde mais wordmark minúsculo arredondado.
- **Tom:** curto, bem-humorado, imperativo.

**222**: ver 1.7; é o destaque mais próximo da proposta "convite íntimo para um encontro planejado".

### 1.13 O que se repete e o que muda

- **Serifa de título** aparece nos que prometem intimidade e confiança: Timeleft, Hinge, 222 (Crimson Pro). Sans pesada e arredondada aparece nos que prometem jogo: Gartic, Duolingo, Bumble.
- **Escuro** em Thursday, Feeld, 222 e Gartic; **claro e quente** em Timeleft, Hinge, Bumble e Meetup. Não há referência em que o par claro/escuro seja igual; o Duora precisa dos dois (os testes de contraste já medem os dois temas).
- **Foto de pessoas** domina Timeleft, Hinge, Thursday, Bumble e Partiful. Só 222, Raya, Gartic, Lex e Duolingo vivem sem fotografia, e é aí que o Duora se encaixa: não há pessoas reais para mostrar antes do lançamento.
- **Prova social** nos grandes é número de membros e depoimento. Pré-lançamento o Duora não tem nem um nem outro; a seção deve usar o contador real da waitlist (quando houver) ou ser omitida, nunca depoimento inventado.
- **CTA** é sempre uma pílula ou retângulo de contraste máximo, repetido no topo e no fim da página.

---

## 2. Três direções para o Duora

Premissas comuns:

- O produto é para adultos e é lúdico: "estética adulta e lúdica" (plano técnico, seção 1).
- Idioma da interface: pt-BR.
- Tailwind 4, tokens em OKLCH em `src/index.css` (hoje com matiz 265 provisório) e teste de contraste nos dois temas. As paletas abaixo foram conferidas com `culori` (contraste WCAG calculado, gamut sRGB checado).
- Todas as fontes têm licença OFL 1.1 e existem no Google Fonts e no Fontsource (confirmado pela API do Fontsource). Instalação sugerida: `@fontsource-variable/<nome>`.
- Imagens de fundo geradas: sem texto, sem pessoas, para não haver rosto reconhecível nem aparência de pessoa real prometida pelo app.

### Direção A: "Mesa posta" (escuro editorial, íntimo)

Ideia: o convite para uma noite a dois, com cartas e dados na mesa. Serifa expressiva, luz de vela, humor discreto.

**Fontes**
- Título: **Fraunces** (variável, eixos de peso e `opsz`; use o óptico alto nos títulos grandes e peso 500 a 600).
- Corpo e UI: **Hanken Grotesk** (variável 100 a 900).

**Paleta em OKLCH** (tema escuro é o padrão; o claro vem do mesmo matiz)

| Token | OKLCH | Hex aprox. | Uso |
|---|---|---|---|
| bg-950 | `oklch(0.19 0.025 330)` | `#1a1019` | fundo da página (ameixa quase preto) |
| bg-900 | `oklch(0.23 0.03 330)` | `#251824` | superfícies |
| bg-800 | `oklch(0.28 0.035 330)` | `#332331` | cartões elevados |
| edge | `oklch(0.55 0.04 330)` | `#7f697d` | bordas de componente (3,75:1 sobre bg-950) |
| fg | `oklch(0.96 0.02 85)` | `#f8f1e3` | texto (16,5:1 sobre bg-950) |
| fg-muted | `oklch(0.76 0.03 60)` | `#c0ad9e` | texto secundário (8,6:1 sobre bg-950) |
| primary-400 | `oklch(0.78 0.14 55)` | `#fb9d59` | primária: damasco; CTA e foco |
| primary-600 | `oklch(0.6 0.15 48)` | `#c55f1d` | hover e estados pressionados |
| accent-300 | `oklch(0.82 0.09 10)` | `#f8acb7` | acento: rosa-chá, para destaques e jogo |
| on-primary | `oklch(0.2 0.03 330)` | `#1e111c` | texto sobre a primária (8,8:1) |
| light-bg | `oklch(0.97 0.012 85)` | `#f9f5ec` | fundo do tema claro (creme) |
| light-fg | `oklch(0.24 0.03 330)` | `#271a26` | texto no claro (15,2:1) |
| light-primary | `oklch(0.52 0.13 48)` | `#a34d16` | primária no claro (5,3:1 com creme) |

Neutros com temperatura: os cinzas puxam para ameixa no escuro e para creme-quente no claro.

**Logo**
Wordmark "duora" minúsculo em Fraunces. O "o" é desenhado como dois anéis que se sobrepõem em lente (um damasco, outro rosa-chá): duas pessoas que se encontram. O favicon e o ícone do app são só a lente. Animação opcional: os anéis se afastam e voltam no hover.

**Estilo das imagens de fundo**
Fotografia analógica de natureza-morta, luz baixa e quente, grão de filme, muito espaço negativo para o título. Nada de rostos; objetos de jogo e de mesa. Sempre com overlay `bg-950` entre 40 e 70% para garantir contraste do texto.

Prompts (inglês, sem texto, sem pessoas reconhecíveis):
1. `Cinematic still life of a small restaurant table at night, two empty wine glasses and a deck of playing cards fanned out, warm candlelight, deep plum shadows, shallow depth of field, 35mm film grain, no people, no text, no logos, wide 16:9`
2. `Abstract warm bokeh of string lights and window reflections in a dark bar, apricot and rose highlights on a deep aubergine background, soft focus, analog film grain, no people, no text, wide 16:9`
3. `Overhead view of a dark wooden table with two small game pieces facing each other, soft apricot rim light, aubergine background, minimal composition with large empty negative space on the left for a headline, no people, no text`

**Estrutura da landing** (mobile primeiro; no desktop, hero em duas colunas)
1. Barra mínima: logo e botão "Entrar na lista".
2. Hero: frase interativa no estilo 222, em português ("vamos jogar `[adivinha o desenho]` com `[quem você ainda não conhece]`"), com o trecho entre colchetes alternando; subtítulo de uma linha; formulário de e-mail com CTA damasco.
3. "Como funciona" em 3 passos (você é combinado, joga junto, só depois conversa), cada um com uma natureza-morta pequena.
4. Uma amostra jogável: um minijogo de 20 segundos incorporado (prova de produto no lugar de depoimento).
5. Segurança em um bloco (sair, bloquear e denunciar sempre à vista), alinhado ao plano técnico.
6. FAQ curto (5 perguntas).
7. CTA final repetido, rodapé com privacidade.

**Tom do texto:** íntimo, seco e caloroso; frases curtas, minúsculas permitidas nos títulos, humor discreto. Ex.: "Antes de conversar, jogue. Dá menos medo."

### Direção B: "Parquinho adulto" (claro, colagem e adesivos)

Ideia: um playground de papel recortado. Cor forte, formas orgânicas, adesivos, ar de revista independente.

**Fontes**
- Título: **Bricolage Grotesque** (variável 200 a 800, com eixo de largura e `opsz`; peso 700 a 800 nos títulos).
- Corpo e UI: **Figtree** (variável 300 a 900).

**Paleta em OKLCH** (claro é o padrão; o escuro usa as mesmas famílias)

| Token | OKLCH | Hex aprox. | Uso |
|---|---|---|---|
| paper | `oklch(0.975 0.015 95)` | `#faf7ec` | fundo (papel creme) |
| paper-2 | `oklch(0.94 0.03 95)` | `#f1ebd5` | seções alternadas |
| ink | `oklch(0.24 0.04 285)` | `#1d1c31` | texto (15,4:1 sobre paper) |
| ink-muted | `oklch(0.47 0.04 285)` | `#585871` | texto secundário (6,4:1) |
| edge | `oklch(0.55 0.04 285)` | `#6f6f89` | bordas de componente (4,6:1) |
| primary-600 | `oklch(0.49 0.23 300)` | `#7827cb` | primária: violeta; CTA (6,7:1 com `on-primary`) |
| primary-200 | `oklch(0.88 0.06 305)` | `#e0cef8` | fundos de blob e chips |
| primary-100 | `oklch(0.94 0.03 305)` | `#f0e7fc` | superfícies suaves |
| on-primary | `oklch(0.98 0.01 300)` | `#f9f7fe` | texto sobre a primária |
| accent-lime | `oklch(0.9 0.2 125)` | `#c0f447` | acento 1: destaque e selos (12,8:1 com `ink`) |
| accent-coral | `oklch(0.7 0.19 30)` | `#fe6652` | acento 2: alertas amigáveis, adesivos (5,7:1 com `ink`) |
| accent-sky | `oklch(0.82 0.09 225)` | `#81d1f0` | acento 3: fundos de jogo (9,7:1 com `ink`) |
| dark-bg / dark-fg | `oklch(0.2 0.045 295)` / `oklch(0.96 0.015 95)` | `#181128` / `#f5f2e7` | tema escuro (16,3:1) |
| dark-primary | `oklch(0.76 0.15 305)` | `#c797fd` | primária no escuro (8,1:1) |

Regra: nunca lime sobre violeta para texto (4,2:1, só decoração).

**Logo**
Wordmark "duora" em Bricolage extra-pesada, com cada letra num recorte de papel levemente inclinado. Símbolo: duas formas orgânicas (violeta e lima) que se encaixam como peças de quebra-cabeça e desenham um sorriso no encaixe. Pode virar adesivo (contorno branco grosso) para uso em perfil e conquistas.

**Estilo das imagens de fundo**
Colagem vetorial em papel recortado: blobs sobrepostos, confete geométrico, textura de papel, sombras suaves de adesivo. Personagens são formas simples sem rosto, para ninguém se parecer com ninguém.

Prompts:
1. `Flat vector collage of overlapping organic blob shapes in violet, lime, coral and sky blue on a warm cream paper background, subtle paper grain texture, playful geometric confetti, no text, no people, no faces, wide 16:9`
2. `Cut-paper style illustration of two abstract characters made of simple shapes, one violet blob and one lime blob, leaning toward each other and tossing a small die between them, flat colors, soft drop shadow, cream background, no text, no faces`
3. `Seamless pattern of hand-cut paper stickers: dice, speech bubbles, stars, hearts and a game controller, in violet, lime, coral and sky blue with a thick white sticker outline, cream background, no text, no letters, no people`

**Estrutura da landing**
1. Barra: logo-adesivo e "Entrar na lista".
2. Hero: H1 grande em duas linhas com um recorte de papel inclinado atrás da palavra-chave; ao lado (desktop) ou abaixo (mobile) a colagem de personagens jogando; formulário de e-mail.
3. Faixa de adesivos rolando com tipos de experiência ("Adivinha o desenho", "Quiz a dois", "Desafio de 5 minutos"), marcados como exemplos e não como catálogo final.
4. "Como funciona" em cartões com cor própria (violeta, lima, coral) e número grande.
5. Bloco "Para quem é" com 3 retratos de arquétipos feitos de formas (sem rosto).
6. Segurança e privacidade em cartão fixo, FAQ.
7. CTA final em tela cheia violeta, rodapé.

**Tom do texto:** brincalhão, de colagem de revista; exclamação com moderação, trocadilhos leves, chamadas curtas. Ex.: "Dois jogadores. Um jogo. Zero papo furado... por enquanto."

### Direção C: "Fliperama suave" (gradiente noturno, jogo)

Ideia: o brilho de uma sala de jogos à noite. Gradiente profundo, menta de neon, peças de jogo luminosas.

**Fontes**
- Título: **Unbounded** (variável 200 a 900; larga e arredondada, só em títulos de 28 px para cima).
- Corpo e UI: **Onest** (variável 100 a 900).

**Paleta em OKLCH** (escuro é o padrão; o claro troca o fundo por lavanda-claro)

| Token | OKLCH | Hex aprox. | Uso |
|---|---|---|---|
| night-950 | `oklch(0.17 0.06 285)` | `#0e0928` | fundo |
| night-900 | `oklch(0.22 0.09 290)` | `#1c0e40` | superfícies |
| night-700 | `oklch(0.34 0.15 295)` | `#411b7b` | cartões elevados, gradiente |
| edge | `oklch(0.55 0.1 295)` | `#7665a6` | bordas (3,8:1 sobre night-950) |
| fg | `oklch(0.98 0.01 300)` | `#f9f7fe` | texto (18,2:1 sobre night-950) |
| fg-muted | `oklch(0.82 0.04 295)` | `#c5c0dc` | texto secundário (10,9:1) |
| primary (violet-500) | `oklch(0.5 0.24 295)` | `#742ad9` | primária; fundo de botão com `fg` (6,4:1) |
| accent (magenta-600) | `oklch(0.55 0.2 350)` | `#bf2a82` | acento para fundos; texto branco por cima (5,1:1) |
| magenta-400 | `oklch(0.72 0.2 350)` | `#fc65b6` | acento como texto no escuro (7,1:1) |
| mint-400 | `oklch(0.82 0.17 165)` | `#15e6a8` | destaque de ação e "pronto" (11,2:1 com `on-mint`) |
| on-mint | `oklch(0.2 0.05 285)` | `#14122b` | texto sobre menta |
| sun-300 | `oklch(0.9 0.15 95)` | `#fddc5b` | pontuação e estrelas |
| light-bg / light-fg | `oklch(0.97 0.012 300)` / `oklch(0.22 0.07 290)` | `#f6f3fc` / `#1b1338` | tema claro (16,1:1) |
| light-primary | `oklch(0.48 0.24 295)` | `#6e21d2` | primária no claro (6,8:1) |

Cuidado: magenta com texto branco só a partir de `oklch(0.55 0.2 350)` (5,1:1); a `0.62` dá 3,9:1 e só vale para texto grande ou decoração.

**Logo**
Símbolo: duas meias-luas (menta e magenta) separadas por uma fresta diagonal, que juntas formam um "o" e lembram uma ficha de jogo. Wordmark "duora" minúsculo em Unbounded. Animação: as metades giram e se encaixam, como um minijogo de "encaixar". O ícone do app é o círculo sobre `night-950`.

**Estilo das imagens de fundo**
Gradiente de malha (mesh) de índigo para violeta para magenta, com granulação e uma luz menta num canto; peças de jogo geométricas (meias-luas, dado, estrela) translúcidas e brilhantes em render de estúdio. Sem fotografia.

Prompts:
1. `Smooth mesh gradient background from deep indigo to electric violet to hot magenta, subtle film grain, a soft glowing mint light bloom in the lower right corner, abstract, no text, no people, wide 16:9`
2. `Abstract glossy translucent geometric game tokens floating over a dark indigo gradient, two half-circles, a die and a star, mint and magenta rim lights, soft reflections, studio 3D render, no text, no people, no faces`
3. `Retro arcade carpet pattern reimagined as minimal vector shapes, glowing mint and magenta lines on a near-black indigo background, subtle halftone, seamless tile, no text, no characters`

**Estrutura da landing**
1. Barra translúcida com logo e "Entrar na lista".
2. Hero: H1 em Unbounded sobre o gradiente, ficha animada ao lado, formulário de e-mail com botão menta.
3. "Como funciona" como fases de um jogo (Fase 1, 2, 3), com barra de progresso que preenche ao rolar.
4. Vitrine de minijogos em cartões de "fliperama" com mini-animação CSS (respeitando `prefers-reduced-motion`).
5. Bloco de segurança e FAQ.
6. CTA final com contagem real da waitlist (se houver) e rodapé.

**Tom do texto:** energia de jogo, verbos de fase e pontuação, humor "arcade". Ex.: "Aperte start. Ele(a) também."

---

## 3. Comparação rápida

| Critério | A. Mesa posta | B. Parquinho adulto | C. Fliperama suave |
|---|---|---|---|
| Sinal "adulto" (encontro, confiança) | Forte | Médio | Médio a fraco |
| Sinal "lúdico" (jogo) | Médio | Forte | Forte |
| Parentesco com referência | 222, Hinge, Thursday | Meetup, Lex, Bumble | Gartic, Feeld |
| Risco de parecer cópia | Médio (222: escuro + serifa creme) | Médio (Meetup: blobs e adesivos) | Alto (cara de Discord/Twitch/Gartic) |
| Custo de produzir imagens sem pessoas | Baixo: natureza-morta e bokeh | Alto: precisa de ilustração consistente | Médio: gradiente e render 3D |
| Contraste nos dois temas | AAA no escuro, AA no claro | AAA no claro, AAA no escuro | AAA no escuro, AA no claro |
| Peso das fontes | Duas variáveis leves | Duas variáveis leves | Unbounded larga: só em títulos |

---

## 4. Recomendação: Direção A, "Mesa posta"

Por quê:

1. **O público é adulto e o risco do produto é confiança.** O Duora pede a alguém que jogue com um desconhecido. As referências que passam segurança (Hinge, Timeleft, 222) usam serifa e tom caloroso; Fraunces com creme e damasco dá essa leitura sem parecer app infantil.
2. **O lúdico entra pelo conteúdo, não pela estética.** A frase interativa do hero e o minijogo de 20 segundos incorporado na landing mostram o produto no lugar de depoimentos que ainda não existem. Isso resolve a prova social sem inventar número.
3. **Diferencia do que está saturado.** Roxo e magenta de jogo (C) e blobs de adesivo (B) já pertencem a Gartic, Discord, Meetup e Bumble. Ameixa com damasco ainda está livre no nicho.
4. **Imagem barata e segura.** Natureza-morta, bokeh e gradiente com granulação são fáceis de gerar de forma consistente, não têm rosto e funcionam atrás de texto com overlay. B exige um sistema de ilustração que um projeto solo teria de manter.
5. **Cabe nos tokens e testes existentes.** A paleta já vem com os dois temas, os contrastes medidos (todos acima de 4,5:1 para texto, 3:1 para bordas) e matiz único para os neutros, o que casa com o `theme.test.ts` atual.

Custo principal e mitigação:

- **Risco de ficar sério demais.** Escuro e serifa podem esconder o "jogo". Mitigar com microcopy bem-humorada, a frase interativa, movimento nos anéis do logo e o minijogo no hero.
- **Parentesco com o 222.** Mudar o matiz (ameixa em vez de verde), usar Fraunces em vez de Crimson Pro e ter formulário e minijogo visíveis na primeira dobra.

Sugestão para depois (não é parte da recomendação): reaproveitar a paleta C como tema das salas de jogo dentro do app, onde o ambiente de arcade ajuda, e manter a A na landing e nas telas de cadastro.

## 5. Próximos passos (a decidir)

- Escolher a direção.
- Se for A: substituir os tons provisórios de `src/index.css` (matiz 265) pelos acima, adicionar `@fontsource-variable/fraunces` e `@fontsource-variable/hanken-grotesk`, e estender `themeTokens.test.ts` com os pares listados.
- Gerar as três imagens do hero e escolher uma após ver a legibilidade do título sobre cada uma.
- Registrar a escolha em ADR do front (`docs/adr/`), já que fixa fonte, paleta e linguagem visual.
