# Duora Web

[![CI](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml/badge.svg)](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml)

Front web do Duora: encontros entre adultos por experiências e minijogos compartilhados.
React 19, TypeScript 6 (`strict`), Vite 8 e Tailwind CSS 4. O backend é a
[duora-api](https://github.com/BipoXDXD/duora-api) (Java 25 e Spring Boot 4).

O projeto está no início. Por enquanto ele tem os dois layouts, a base visual (tokens, tema escuro e
contraste testado), o cliente HTTP compatível com o login da API e a primeira feature, a inscrição na
**lista de espera**.

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

Ainda não dá para saber quem está logado nem sair pelo front. Veja [Pendências](#pendências).

## Duas interfaces: desktop e smartphone

O app tem **duas cascas**, e não uma única página responsiva:

- **Desktop** (`DesktopLayout`): cabeçalho com a marca, a navegação e o botão "Entrar".
- **Smartphone** (`MobileLayout`): cabeçalho compacto e barra de navegação inferior, ao alcance do
  polegar e respeitando a safe area do aparelho.

A escolha usa um único breakpoint, `48rem` (768px, o `md` do Tailwind), definido em
`src/app/useIsDesktop.ts`. O hook lê `matchMedia` com `useSyncExternalStore`, e o layout troca na
hora quando a janela cruza o limite.

As features (como `JoinWaitlistForm`) são as mesmas nas duas cascas; só a navegação e a moldura
mudam. Assim, a experiência no celular pode divergir de verdade (barra inferior, menos itens),
sem encher cada componente de classes condicionais. O custo é manter duas cascas. Dentro das
features, ajustes pequenos continuam com as classes responsivas do Tailwind.

## Base visual

Os tokens ficam em `src/index.css`, a fonte única deles, em duas camadas:

- **Tons crus**, definidos de antemão em OKLCH: `ink` (cinza frio no matiz da marca), `brand` (primária) e
  `danger` (perigo), cada um de 50 a 950. Os componentes nunca usam um tom cru.
- **Tokens semânticos**, que os componentes usam: `canvas`, `surface`, `fg`, `fg-muted`, `fg-accent`,
  `primary`, `on-primary`, `danger`, `edge`, `focus` e outros, como em `bg-surface` ou `text-fg-muted`. A
  paleta padrão do Tailwind foi removida (`--color-*: initial`), então só eles existem.

O **tema escuro** segue `prefers-color-scheme` e só redefine os tokens semânticos. Nele a sombra some e a
elevação vem da superfície mais clara que a página.

`src/app/theme.test.ts` lê os tokens do `index.css` e mede, nos dois temas, cada par que os componentes
usam: 4,5:1 para texto, 3:1 para texto grande, borda de componente e anel de foco. O teste também falha se um
componente usar um tom cru ou se um token semântico novo não entrar em nenhum par. Para incluir uma cor:
crie o token, use-o no componente e acrescente o par em `PAIRS`.

Interação acessível:

- um anel de foco único (`:focus-visible`, 3px na cor `focus`) para todo elemento focável;
- alvo de toque de 44×44px (`min-h-11 min-w-11`) em todo link, botão e campo, conferido em teste;
- `prefers-reduced-motion` desliga animações e transições;
- todo campo tem label, também conferido em teste.

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

Vitest com jsdom e Testing Library. Os testes trocam o `fetch` global por um stub (`vi.stubGlobal`)
e verificam o que vai para a API (caminho, método, corpo, header CSRF) e o que a tela mostra para
cada resposta: 202, 400, 429 com e sem `Retry-After`, erro do servidor e falha de rede. O
`matchMedia`, que o jsdom não tem, é simulado em `src/test/fakeMatchMedia.ts`. O contraste das cores é medido
com o `culori` sobre os tokens lidos do `index.css` (veja [Base visual](#base-visual)).

## Estrutura

```
src/
  app/                 casca: App, os dois layouts, o breakpoint e a página inicial
  features/
    auth/              URL de login do BFF
    waitlist/          chamada a POST /api/waitlist e o formulário de inscrição
  shared/api/          cliente HTTP (mesma origem, CSRF, ApiError)
  test/                setup do Vitest, fakes e leitor dos tokens do tema
  index.css            tokens visuais e estilos base (foco, movimento reduzido)
```

O código fica organizado por feature, como os módulos da duora-api.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) roda lint, checagem de tipos, testes com cobertura
e build. Também roda o gitleaks sobre todo o histórico. As actions ficam fixadas por SHA.

## Pendências

Estas dependem de mudanças na duora-api:

- `GET /api/me`, para o front saber se há sessão e mostrar "Sair" no lugar de "Entrar".
- Logout pelo front: hoje `POST /logout` responde 302 para o Entra, e o `fetch` não segue esse
  redirect entre origens. A API precisa responder 200 com a URL de logout, para o front navegar
  até ela.
