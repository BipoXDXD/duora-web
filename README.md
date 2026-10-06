# Duora Web

[![CI](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml/badge.svg)](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml)

Front web do Duora: encontros entre adultos por experiências e minijogos compartilhados.
React 19, TypeScript 6 (`strict`), Vite 8 e Tailwind CSS 4. O backend é a
[duora-api](https://github.com/BipoXDXD/duora-api) (Java 25 e Spring Boot 4).

O projeto está no início. Por enquanto ele tem os dois layouts, a identidade visual "Mesa posta" (tokens,
dois temas e contraste testado), o cliente HTTP compatível com o login da API, o estado de sessão (entrar e
sair) e a landing com a primeira feature, a inscrição na **lista de espera**.

## Pré-requisitos

- Node.js 24 (a versão está em `.nvmrc`)
- A duora-api rodando em `http://localhost:8080`, para usar o app de verdade. Os testes não
  precisam dela.

## Rodando com a API local

Na duora-api (detalhes no README dela):

```bash
set -a; source ~/.config/duora/dev.env; set +a
./mvnw spring-boot:run
```

Aqui:

```bash
npm ci
npm run dev
```

Abra `http://localhost:5173`. O Vite repassa `/api`, `/oauth2`, `/login/oauth2`, `/logout` e
`/actuator` para a API. Assim, front e API ficam na mesma origem, sem CORS.

O proxy **não** troca o header `Host` (`changeOrigin: false`). Com isso o Spring monta o
`redirect_uri` do Entra para `http://localhost:5173/login/oauth2/code/entra`, já registrado no
tenant, e o cookie de sessão nasce na origem do Vite.

## Login e CSRF

O login é por BFF (ADR 0002 da duora-api). O navegador nunca vê um token:

- **Entrar** é uma navegação para `/oauth2/authorization/entra`. O Spring conversa com o Entra e
  devolve só o cookie `__Host-DUORA_SESSION` (`HttpOnly`, `Secure`, `SameSite=Lax`).
- Toda mutação leva o header `X-XSRF-TOKEN` com o valor do cookie `XSRF-TOKEN`. Quem faz isso é o
  cliente HTTP (`src/shared/api/http.ts`), o único ponto de saída para a API.

Em desenvolvimento, um cookie `__Host-` com `Secure` funciona em `http://localhost` no Chrome e no
Firefox, que tratam `localhost` como contexto seguro. O Safari não aceita: use outro navegador.

### Sessão no front

- `GET /api/me` diz quem está logado: 200 com `{"displayName": "..." | null}` ou 401 para quem não entrou. O
  hook `useSession` (`src/features/auth/useSession.ts`) guarda a resposta no TanStack Query e devolve uma união:
  `loading`, `anonymous`, `authenticated` (com o usuário) ou `error` (com `retry`). Sem retry automático; ao voltar
  para a aba, a sessão é checada de novo, e se essa nova checagem falhar continua valendo a última conhecida.
- **Sair** faz `POST /logout` (com o header CSRF), recebe `{"logoutUrl": "..."}` e navega até essa URL, que encerra
  a sessão também no Entra. Só URL `https:` é aceita, porque o front navega para ela.
- Os dois cabeçalhos mostram "Entrar", o nome e "Sair", ou "Tentar de novo" quando a API não respondeu. No celular,
  "Sair" fica na barra inferior. Falha no logout aparece como alerta (`role="alert"`).
- Todo corpo de resposta passa por um schema Zod (`zod/mini`, mais leve) em `readJsonBody`, no cliente HTTP; nada
  usa `as` sobre `res.json()`. Falhas esperadas viram estado na tela: `ApiError` (status), `NetworkError` (o `fetch`
  rejeitou, encapsulado só em `sendApiRequest`) e `InvalidResponseError` (corpo fora do contrato). Qualquer outro
  erro, inclusive um `TypeError` do nosso código, é tratado como bug e sobe para o React.

## Duas interfaces: desktop e smartphone

O app tem **duas cascas**, e não uma única página responsiva:

- **Desktop** (`DesktopLayout`): cabeçalho com a marca, a navegação e a sessão ("Entrar" ou o nome e "Sair").
- **Smartphone** (`MobileLayout`): cabeçalho compacto (com o nome de quem entrou) e barra de navegação
  inferior com "Entrar" ou "Sair", ao alcance do polegar e respeitando a safe area do aparelho.

A escolha usa um único breakpoint, `48rem` (768px, o `md` do Tailwind), definido em
`src/app/useIsDesktop.ts`. O hook lê `matchMedia` com `useSyncExternalStore`, e o layout troca na
hora quando a janela cruza o limite.

As features (como `JoinWaitlistForm`) são as mesmas nas duas cascas; só a navegação e a moldura
mudam. Assim, a experiência no celular pode divergir de verdade (barra inferior, menos itens),
sem encher cada componente de classes condicionais. O custo é manter duas cascas. Dentro das
features, ajustes pequenos continuam com as classes responsivas do Tailwind.

## Identidade visual

A direção é a "Mesa posta": um convite para uma noite a dois, à luz de vela. A escolha, as alternativas e os
trade-offs estão na [ADR 0001](docs/adr/0001-identidade-visual.md); a pesquisa que a embasa, em
[`docs/design-research.md`](docs/design-research.md).

- **Fontes:** Fraunces (títulos, eixo `opsz`) e Hanken Grotesk (texto e UI), variáveis e servidas pelo próprio site
  com `@fontsource-variable/*`.
- **Logo:** `src/shared/brand/Logo.tsx`. As letras são contornos do Fraunces em SVG, então o logo não depende da fonte
  carregada; o "o" são dois anéis entrelaçados (damasco e rosa-chá) que se afastam no hover, só para quem não pediu menos
  movimento. O favicon (`public/favicon.svg`) e o `public/apple-touch-icon.png` (180×180) usam só a lente. O PNG foi
  renderizado a partir do mesmo desenho do favicon; se a lente mudar, gere-o de novo.

### Tokens e temas

Os tokens ficam em `src/index.css`, a fonte única deles, em duas camadas:

- **Tons crus**, definidos de antemão em OKLCH: `plum` (ameixa), `cream` (creme), `apricot` (damasco, a primária),
  `rose` (rosa-chá, o acento) e `danger`. Os componentes nunca usam um tom cru.
- **Tokens semânticos**, que os componentes usam: `canvas`, `surface`, `fg`, `fg-muted`, `fg-accent`, `primary`,
  `accent`, `on-primary`, `danger`, `edge`, `focus`, `glow` e outros, como em `bg-surface` ou `text-fg-muted`. A paleta
  padrão do Tailwind foi removida (`--color-*: initial`).

Cada token semântico guarda os dois temas em `light-dark(claro, escuro)`, dentro de `@theme inline`. O lado é escolhido
pelo `color-scheme` de cada elemento:

- a raiz usa `color-scheme: dark light`, ou seja, segue a preferência do sistema, com o escuro primeiro;
- o botão de tema fixa `data-theme="light"` ou `"dark"` na raiz e guarda a escolha no `localStorage` (com `try/catch`:
  se o armazenamento estiver bloqueado, o tema troca, mas não é lembrado);
- as **seções noturnas** (hero, cartões do minijogo e da segurança, perguntas e chamada final) usam `scheme-dark` e
  ficam escuras também no tema claro.

O `@theme inline` não é detalhe: no build, o Lightning CSS troca `light-dark()` por variáveis para navegadores sem suporte
(Safari 16.4+), e isso só respeita as seções noturnas se cada classe carregar o próprio `light-dark()`. Veja a ADR.

`src/app/theme.test.ts` lê os tokens do `index.css` e mede, nos dois temas, cada par que os componentes usam: 4,5:1 para
texto, 3:1 para texto grande, borda de componente e anel de foco. O teste também falha se um componente usar um tom cru
ou se um token semântico novo não entrar em nenhum par. Para incluir uma cor: crie o token, use-o no componente e
acrescente o par em `PAIRS`.

Interação acessível:

- um anel de foco único (`:focus-visible`, 3px na cor `focus`) para todo elemento focável;
- alvo de toque de 44×44px (`min-h-11 min-w-11`, ou `min-h-12` no formulário do hero) em todo link, botão e campo,
  conferido em teste;
- `prefers-reduced-motion` desliga animações e transições; a frase do hero começa parada e tem botão de pausa;
- todo campo tem label, também conferido em teste.

### Imagens

Natureza-morta gerada por IA, sem pessoas e sem texto, pela API do Tripo (text-to-image). Hero, segurança, minijogo,
FAQ e chamada final vieram do GPT Image 2.5 (`chat_image_2.5_flare`); os três passos, do Nano Banana Pro (`banana_pro`).
Todas em WebP:

| Arquivo | Tamanho | Onde |
|---|---|---|
| `public/backgrounds/hero.webp` / `hero-mobile.webp` | 1920×1080 / 1080×1350 | hero (único carregamento antecipado, `fetchpriority="high"`) |
| `public/backgrounds/candle.webp` | 1920×1080 | chamada final (mesa para dois num wine bar) |
| `public/backgrounds/minigame.webp` | 1920×1080 | bloco "em breve" do minijogo |
| `public/backgrounds/safety.webp` | 1920×1080 | bloco de segurança |
| `public/backgrounds/faq.webp` | 1920×1080 | fundo das perguntas |
| `public/images/step1-match.webp`, `step2-play.webp`, `step3-talk.webp` | 800×1000 | passos de "como funciona", com `alt` |

Uma imagem nova de fundo segue o mesmo formato: 1920×1080 e, quando o recorte no celular perder o assunto, uma versão
retrato de 1080×1350 com o sufixo `-mobile`. O componente `BackdropImage` serve a retrato abaixo de 48rem e a larga acima.
Se o arquivo faltar, ele se remove e aparece o gradiente `candlelight` com grão. Ao trocar uma imagem, confira no
navegador o contraste do texto sobre ela com o véu aplicado (a ADR descreve como foi medido).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com o proxy para a API |
| `npm run build` | Checa tipos e gera o build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | oxlint; avisos também falham |
| `npm run typecheck` | `tsc -b`, separado do build porque o Vite só transpila |
| `npm test` | Testes com Vitest |
| `npm run test:watch` | Testes em modo watch |
| `npm run coverage` | Testes com cobertura (relatório em `coverage/`) |

## Testes

Vitest com jsdom e Testing Library. Os testes trocam o `fetch` global por um stub (`vi.stubGlobal`, ou
`stubApi` em `src/test/fakeApi.ts`, que responde por caminho) e verificam o que vai para a API (caminho,
método, corpo, header CSRF) e o que a tela mostra para cada resposta: 202, 400, 429 com e sem `Retry-After`,
401 (visitante anônimo), erro do servidor, corpo fora do contrato e falha de rede. A navegação de página
inteira (`src/shared/browser/navigateTo.ts`) é trocada por um dublê nos testes de componente, porque o jsdom
não navega. O
`matchMedia`, que o jsdom não tem, é simulado em `src/test/fakeMatchMedia.ts`. O contraste das cores é medido
com o `culori` sobre os tokens lidos do `index.css` (veja [Tokens e temas](#tokens-e-temas)).

## Estrutura

```
src/
  app/                 casca: App, os dois layouts, o breakpoint, a página inicial e o tema
    theme/             escolha de tema (data-theme + localStorage) e o botão
  features/
    auth/              sessão (GET /api/me), logout, URL de login e os controles dos cabeçalhos
    landing/           seções da landing: hero com a frase interativa, como funciona, minijogo, segurança, FAQ
    waitlist/          chamada a POST /api/waitlist e o formulário de inscrição
  shared/
    api/               cliente HTTP (mesma origem, CSRF, ApiError, corpo validado por schema)
    browser/           navegação de página inteira
    brand/             logo em SVG
    ui/                imagem de fundo decorativa (BackdropImage)
  test/                setup do Vitest, fakes e leitor dos tokens do tema
  index.css            tokens visuais e estilos base (foco, movimento reduzido, grão, gradiente)
docs/
  adr/                 decisões do front (0001: identidade visual)
  design-research.md   pesquisa de referências e as três direções
```

O código fica organizado por feature, como os módulos da duora-api.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) roda lint, checagem de tipos, testes com cobertura
e build. Também roda o gitleaks sobre todo o histórico. As actions ficam fixadas por SHA.

## Pendências

- Os tipos de `GET /api/me` e `POST /logout` estão escritos à mão em Zod, a partir dos testes da duora-api.
  Quando a API publicar a spec OpenAPI, os tipos e schemas passam a ser gerados dela.
- O app ainda não tem um error boundary: um bug que sobe para o React desmonta a página inteira.
