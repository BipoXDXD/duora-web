# Duora Web

[![CI](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml/badge.svg)](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml)

Front web do Duora: encontros entre adultos por experiências e minijogos compartilhados.
React 19, TypeScript 6 (`strict`), Vite 8 e Tailwind CSS 4. O backend é a
[duora-api](https://github.com/BipoXDXD/duora-api) (Java 25 e Spring Boot 4).

O projeto está no início. Por enquanto ele tem os dois layouts, a identidade visual "Mesa posta" (tokens,
dois temas e contraste testado), o cliente HTTP compatível com o login da API, o estado de sessão (entrar e
sair), a landing com a inscrição na **lista de espera**, e as telas de **Meu perfil** e **Contas bloqueadas**.

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

## Páginas e navegação

| Caminho | Página | Quem vê |
|---|---|---|
| `/` | Landing e lista de espera | Todos |
| `/perfil` | Meu perfil: ver e editar | Quem entrou |
| `/perfil/bloqueios` | Contas bloqueadas: listar e desbloquear | Quem entrou |
| outro | Página não encontrada | Todos |

O roteamento é um módulo pequeno em `src/shared/routing/`, sem biblioteca: `routeOf` transforma o caminho numa
união de rotas, `usePathname` o lê com `useSyncExternalStore` (como o `useIsDesktop` lê o `matchMedia`) e o
`AppLink` troca de página com `pushState`, sem recarregar. O `AppLink` é um `<a>` de verdade, então Ctrl/Cmd+clique
e o botão do meio abrem nova aba. Ao abrir uma página, o título (`h1`) recebe o foco, para o leitor de tela
perceber a troca. Se as rotas passarem a precisar de parâmetros, loaders ou aninhamento, vale trocar por uma
biblioteca de roteamento.

O link para o perfil só aparece para quem entrou: "Meu perfil" no cabeçalho do desktop e a aba "Perfil" na barra
inferior do celular. As páginas do perfil mostram "Entre para ver…" a quem não entrou, sem chamar a API.

Em produção, o servidor de arquivos estáticos precisa devolver o `index.html` para `/perfil` e
`/perfil/bloqueios` (SPA fallback), para o recarregar e o link direto funcionarem. O `vite dev` e o `vite
preview` já fazem isso; no Azure Static Web Apps é o `public/staticwebapp.config.json`
(veja [Publicação](#publicação-azure-static-web-apps)).

### Meu perfil

- `GET /api/me/profile` traz o perfil e o `ETag`; os dois ficam juntos no cache do TanStack Query.
- O formulário confere as regras da API antes de enviar (nome de 1 a 50 caracteres, apresentação até 300, data de
  nascimento de maior de 18 e no máximo 120 anos, informada uma vez só) e manda no `PATCH` só os campos que
  mudaram, com `If-Match`. Campo apagado vira `null`; a data de nascimento já informada aparece como texto.
- **412** (o perfil mudou em outra aba ou aparelho): o front lê o perfil de novo, mantém os campos que a pessoa
  editou, mostra a versão nova dos outros e pede para conferir e salvar de novo. **409** faz o mesmo, explicando
  que a data de nascimento já tinha sido informada.
- **400**: a API lista os campos recusados em `errors: [{field, code}]` (`ValidationProblemDetail` da spec, ADR 0018
  da duora-api). O front escolhe a mensagem em português pelo par (campo, `code`), mostra todos os erros de uma vez
  e põe o foco no primeiro campo com erro, na ordem da tela. Se algum erro não for de um campo do formulário
  (corpo inteiro, campo desconhecido) ou a lista vier vazia, o aviso geral "Confira os dados do perfil" aparece
  também. `code` que o front não conhece (a API pode ampliar a lista) só marca o campo como recusado. O `detail` em
  inglês nunca é lido para decidir o campo.
- **401** pede para entrar de novo; falha de rede ou 5xx mantém o que foi digitado e oferece tentar de novo.

### Contas bloqueadas

- `GET /api/me/blocked-accounts` paginado por cursor, com "Carregar mais" até `nextPageToken` ser `null`.
- "Desbloquear" pede confirmação na própria linha ("Sim, desbloquear" ou "Cancelar") e chama
  `POST /api/accounts/{id}:unblock`. A conta sai das páginas em cache, sem recarregar a lista.
- A API não manda o nome de quem foi bloqueado, só o id e a data. Cada linha mostra a data e os últimos 8
  caracteres do id (a parte aleatória do UUIDv7).

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
| `npm run api:types` | Gera `src/shared/api/schema.d.ts` a partir de `api/openapi.json` (veja [Tipos da API](#tipos-da-api)) |
| `npm run typecheck` | `tsc -b`, separado do build porque o Vite só transpila |
| `npm test` | Testes com Vitest |
| `npm run test:watch` | Testes em modo watch |
| `npm run coverage` | Testes com cobertura (relatório em `coverage/`) |

## Tipos da API

Os tipos dos DTOs vêm da spec OpenAPI da duora-api, nunca escritos à mão:

- `api/openapi.json` é uma cópia versionada da spec (`docs/openapi.json` da duora-api). Ela deixa a geração
  reproduzível e sem rede, e a mudança de contrato aparece no diff do PR.
- `npm run api:types` roda o `openapi-typescript` e escreve `src/shared/api/schema.d.ts`. Não edite esse
  arquivo; o CI regenera e falha se ele divergir do que está no commit.
- `src/shared/api/contract.ts` dá nomes curtos aos DTOs usados (`CurrentUserResponse`,
  `JoinWaitlistRequest`, `LogoutResponse`). O corpo enviado ao `POST /api/waitlist` é tipado com `JoinWaitlistRequest`.
- A validação em runtime continua em Zod (`readJsonBody`), porque o tipo não valida nada. O schema de
  `GET /api/me` e de `POST /logout` leem só os campos que o front usa, e testes de tipo (`expectTypeOf` em
  `session.test.ts`) falham na compilação se eles deixarem de bater com o tipo gerado. O do logout aceita só
  URL HTTPS, uma restrição a mais que a spec.

Para atualizar quando a API mudar o contrato (o repositório da API é privado, então use o `gh`):

```bash
gh api repos/BipoXDXD/duora-api/contents/docs/openapi.json -H 'Accept: application/vnd.github.raw' > api/openapi.json
npm run api:types
npm run typecheck
```

Comite a spec e o `schema.d.ts` juntos. O `openapi-typescript` declara suporte só ao TypeScript 5; um
`overrides` no `package.json` o deixa usar o TypeScript 6 do projeto.

## Testes

Vitest com jsdom e Testing Library. Os testes trocam o `fetch` global por um stub (`vi.stubGlobal`, ou
`stubApi` em `src/test/fakeApi.ts`, que responde por caminho, e com `byMethod` e `inSequence` por método e em
sequência) e verificam o que vai para a API (caminho,
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
  deploy/              teste da configuração do Static Web Apps e da CSP frente ao build
  features/
    auth/              sessão (GET /api/me), logout, URL de login, os controles dos cabeçalhos e o RequireSession
    blocks/            contas bloqueadas: listagem paginada e desbloqueio
    profile/           meu perfil: leitura e edição com ETag, regras do formulário e as telas
    landing/           seções da landing: hero com a frase interativa, como funciona, minijogo, segurança, FAQ
    waitlist/          chamada a POST /api/waitlist e o formulário de inscrição
  shared/
    api/               cliente HTTP (mesma origem, CSRF, ApiError, corpo validado por schema) e tipos gerados da spec
    browser/           navegação de página inteira
    brand/             logo em SVG
    routing/           rotas, caminho atual e AppLink (pushState)
    ui/                moldura das páginas, classes dos controles, falha de leitura e imagem de fundo
  test/                setup do Vitest, fakes e leitor dos tokens do tema
  index.css            tokens visuais e estilos base (foco, movimento reduzido, grão, gradiente)
api/                   cópia versionada da spec OpenAPI da duora-api (fonte dos tipos gerados)
docs/
  adr/                 decisões do front (0001: identidade visual)
  design-research.md   pesquisa de referências e as três direções
```

O código fica organizado por feature, como os módulos da duora-api.

## Publicação (Azure Static Web Apps)

O front é publicado no Azure Static Web Apps (ADR 0014 da duora-api). A configuração fica em
`public/staticwebapp.config.json`; o Vite a copia para a raiz de `dist/`, onde o SWA a lê.

- **Fallback de navegação:** todo caminho que não é arquivo devolve `/index.html` (o roteador do app decide a
  página), então recarregar `/perfil` ou abrir um link direto funciona. Ficam **fora** do fallback, para dar 404
  em vez de HTML: `/assets/*`, `/images/*`, `/backgrounds/*`, arquivos soltos na raiz por extensão (favicon,
  ícones, `.js`, `.css`...) e os caminhos que pertencem ao BFF, os mesmos que o Vite repassa em desenvolvimento
  (`/api/*`, `/oauth2/*`, `/login/oauth2/*`, `/logout`, `/actuator/*`). Uma rota nova do app (`/eventos`...)
  não precisa de mudança aqui; um prefixo novo do BFF precisa entrar em `exclude` (o teste falha se o proxy do
  `vite.config.ts` e a lista divergirem).
- **Sem papéis do SWA:** o arquivo não define `routes` com `allowedRoles`, `rewrite` nem `redirect`. Quem
  autentica é o BFF (ADR 0002); a única regra de `routes` é o cache de `/assets/*`.
- **Cache:** `/assets/*` leva `public, max-age=31536000, immutable` (o nome tem hash do conteúdo). O resto,
  inclusive o `index.html` e as páginas do fallback, leva `no-cache` (guarda, mas revalida), para um deploy novo
  valer na hora. No SWA os headers de `routes` não valem para respostas do fallback, por isso o `no-cache` é
  global.
- **Headers de segurança** (globais):
  - `Content-Security-Policy`: `default-src 'self'`, `script-src 'self'`, `style-src 'self'` (sem `unsafe-inline`
    nem `unsafe-eval`), `img-src` e `font-src` com `'self' data:` (o grão do fundo é um SVG em `data:` e o Vite
    embute uma fonte pequena), `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
    `form-action 'self'`, `frame-ancestors 'none'` e `upgrade-insecure-requests`. Nenhum script ou estilo é
    inline. Se um componente passar a usar `style={...}`, o React o aplica pelo CSSOM, que a CSP não bloqueia (só
    o atributo `style=` escrito no HTML seria bloqueado).
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (redundante com `frame-ancestors`, para
    navegador antigo), `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy:
    same-origin` e `Strict-Transport-Security: max-age=31536000` (sem `includeSubDomains` nem `preload`, que
    seriam difíceis de desfazer).
  - `Permissions-Policy` nega sensores, câmera, microfone, localização, pagamento e USB. Quando uma feature
    pedir um deles (voz na sala, por exemplo), libere só ele, aqui.
- **Como conferir:** `deploy/staticwebapp.config.test.ts` lê o JSON (fallback, exclusões, headers) e roda um
  `vite build` num diretório temporário para checar que o `dist/index.html` e o CSS gerados não usam nada que a
  CSP bloqueie (script, estilo ou handler inline, nem fonte ou imagem de outra origem). Em 2026-10-07 o build
  também foi servido com esses headers num navegador real, sem violação de CSP e com as fontes e as imagens
  carregadas. A CSP depende do build: ao trocar de fonte, adicionar CDN, analytics ou imagem externa, o teste
  falha e a política muda junto com o código.
- **Em produção, confira uma vez:** `curl -I https://<site>/perfil` deve mostrar `200` e os headers acima, e
  `curl -I https://<site>/api/me` não pode devolver HTML (sem a saída para o BFF o esperado é um 404 do SWA).

### Pendência: SWA e BFF

O BFF exige que front e API estejam na **mesma origem** (ADR 0002): o cookie `__Host-DUORA_SESSION` não tem
`Domain`, o `XSRF-TOKEN` só é lido pelo JavaScript da origem que o recebeu, não há CORS, e o `redirect_uri` do
Entra é `/login/oauth2/code/entra` no mesmo host. Hoje o SWA (`*.azurestaticapps.net`) e o Container Apps
(`*.azurecontainerapps.io`) são sites diferentes, então o login web **não funciona** entre eles. A decisão é do
usuário (a ADR 0014 deixa o domínio próprio como pendência 4). Opções, sem nada implementado:

| Opção | Prós | Contras |
|---|---|---|
| **A. Front Door (ou Application Gateway) num domínio próprio**, com rotas `/api`, `/oauth2`, `/login/oauth2`, `/logout` para o Container Apps e o resto para o SWA | Mesma origem real; o BFF não muda; o front continua em SWA | Serviço a mais (custo fixo mensal e a configuração de rotas/WAF); exige domínio próprio; o SWA precisa aceitar o host do Front Door (`forwardingGateway`, plano Standard) |
| **B. Plano Standard do SWA com o Container Apps "linkado"** (proxy de `/api/*`) | Sem serviço extra; mesma origem para `/api` | Só proxia `/api`: o BFF teria de mover `/oauth2`, `/login/oauth2` e `/logout` para baixo de `/api` (mudança na API e novos redirect URIs no Entra); o Container Apps passa a aceitar só tráfego vindo do SWA (a documentação diz que remover isso exige apagar o identity provider; pode afetar o app mobile com bearer e a verificação de readiness pelo ingress); teto de 45 s por requisição; Standard é pago |
| **C. Servir o front pelo próprio BFF** (arquivos do `dist/` na imagem da API ou num nginx na frente, no Container Apps) | Mesma origem trivial; sem domínio próprio no piloto; um deploy só | Abandona o SWA da ADR 0014 (exigiria revisá-la); o front passa a ser deploy do container; perde CDN global do SWA |
| **D. Subdomínios do mesmo site (`app.` e `api.`) com cookie de domínio** | Sem serviço extra, só DNS | Incompatível com o `__Host-` e com a ADR 0002 (CORS, CSRF e `connect-src` mudam; o cookie `XSRF-TOKEN` fica ilegível para o front); reabre a decisão de segurança do BFF |

Recomendação: **A** se o piloto precisar do SWA com a API como está (custo e configuração a mais, nenhuma mudança
na API); **C** se o objetivo for a opção mais simples até haver usuários reais. Qualquer que seja a escolha, a
`connect-src 'self'` da CSP continua valendo nas opções A, B e C; só a D a muda.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) roda lint, checagem de tipos, a checagem de drift dos tipos
gerados da spec, testes com cobertura e build. Também roda o gitleaks sobre todo o histórico. As actions ficam fixadas por SHA.

## Pendências

- A cópia da spec em `api/openapi.json` é atualizada à mão; o CI não a compara com a da duora-api, que é um
  repositório privado. Quando o contrato mudar na API, rode a atualização acima.
- Como o SWA fala com o BFF (mesma origem, Front Door ou outra saída) está em aberto e depende de decisão do
  usuário; veja [Pendência: SWA e BFF](#pendência-swa-e-bff). A CSP (`connect-src 'self'`) pressupõe a mesma origem.
- A lista de bloqueios não tem o nome nem a foto de quem foi bloqueado, porque a API não os manda.
