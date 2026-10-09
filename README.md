# Duora Web

[![CI](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml/badge.svg)](https://github.com/BipoXDXD/duora-web/actions/workflows/ci.yml)

Front web do Duora: encontros entre adultos por experiências e minijogos compartilhados.
React 19, TypeScript 6 (`strict`), Vite 8 e Tailwind CSS 4. O backend é a
[duora-api](https://github.com/BipoXDXD/duora-api) (Java 25 e Spring Boot 4).

O projeto está no início. Por enquanto ele tem os dois layouts, a identidade visual "Mesa posta" (tokens,
dois temas e contraste testado), o cliente HTTP compatível com o login da API, o estado de sessão (entrar e
sair), a landing com a inscrição na **lista de espera**, as telas de **Meu perfil** e **Contas bloqueadas**, e as de
**Eventos**: a lista, o evento com a inscrição, a dupla de cada rodada, a **conversa com a dupla** da rodada atual e a
**decisão privada** depois dela, **Minhas inscrições** e **Conexões**. Para o piloto há também a **área da equipe**
(`/admin/...`): listar os eventos (rascunhos incluídos), criar o rascunho de um evento, publicá-lo, cancelá-lo e
iniciar as rodadas, sem `curl`.

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

- `GET /api/me` diz quem está logado: 200 com `{"displayName": "..." | null, "roles": [...]}` ou 401 para quem não entrou.
  `roles` vem sempre (`[]` ou `["ADMIN"]`); o front lê por allowlist (`KNOWN_ROLES` em `session.ts`) e ignora o papel que
  não conhece. Os papéis só decidem o que mostrar, como o link "Equipe"; a API confere o papel em cada rota. O
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
| `/eventos` | Próximos eventos | Quem entrou |
| `/eventos/{id}` | O evento: inscrição e, durante ele, a dupla da rodada | Quem entrou |
| `/inscricoes` | Minhas inscrições | Quem entrou |
| `/conexoes` | Conexões: quem também quis continuar em contato | Quem entrou |
| `/admin/eventos` | Eventos da equipe: todos os estados, com filtro por estado | Só ADMIN, decidido pela API (veja [Área da equipe](#área-da-equipe-admin)) |
| `/admin/eventos/novo` | Novo evento: o formulário do rascunho | Só ADMIN, decidido pela API (veja [Área da equipe](#área-da-equipe-admin)) |
| `/admin/eventos/{id}` | O evento para a equipe: estado, inscritos, publicar, cancelar e rodadas | Só ADMIN, decidido pela API |
| outro | Página não encontrada | Todos |

O roteamento é um módulo pequeno em `src/shared/routing/`, sem biblioteca: `routeOf` transforma o caminho numa
união discriminada de rotas (`{ page: 'event', eventId }` e `{ page: 'adminEvent', eventId }` são as únicas com parâmetro, e só aceitam um UUID), `usePathname` o lê com `useSyncExternalStore` (como o `useIsDesktop` lê o `matchMedia`) e o
`AppLink` troca de página com `pushState`, sem recarregar. O `AppLink` é um `<a>` de verdade, então Ctrl/Cmd+clique
e o botão do meio abrem nova aba. Ao abrir uma página, o título (`h1`) recebe o foco, para o leitor de tela
perceber a troca. Um parâmetro de id não justificou uma biblioteca; se as rotas passarem a precisar de vários
parâmetros, query string, loaders ou aninhamento, vale trocar por uma biblioteca de roteamento.

Os links para "Eventos", "Conexões" e o perfil só aparecem para quem entrou: no cabeçalho do desktop ("Eventos",
"Conexões" e "Meu perfil") e na barra inferior do celular ("Eventos", "Conexões" e "Perfil"). "Minhas inscrições" se abre pela página de eventos, e
"Eventos" fica marcado também nela e em cada evento. As páginas do perfil mostram "Entre para ver…" a quem não entrou, sem chamar a API.

Em produção, o servidor de arquivos estáticos precisa devolver o `index.html` para `/perfil`,
`/perfil/bloqueios`, `/eventos`, `/eventos/{id}`, `/inscricoes`, `/conexoes`, `/admin/eventos`,
`/admin/eventos/novo` e `/admin/eventos/{id}` (SPA fallback), para o recarregar e o
link direto funcionarem. O `vite dev` e o `vite preview` já fazem isso; no Azure Static Web Apps é o
`public/staticwebapp.config.json` (veja [Publicação](#publicação-azure-static-web-apps)).

### Meu perfil

- `GET /api/me/profile` traz o perfil e o `ETag`; os dois ficam juntos no cache do TanStack Query.
- O formulário confere as regras da API antes de enviar (nome de 1 a 50 caracteres, apresentação até 300, data de
  nascimento de maior de 18 e no máximo 120 anos, informada uma vez só) e manda no `PATCH` só os campos que
  mudaram, com `If-Match`. Campo apagado vira `null`; a data de nascimento já informada aparece como texto.
- **412** (o perfil mudou em outra aba ou aparelho): o front lê o perfil de novo, mantém os campos que a pessoa
  editou, mostra a versão nova dos outros e pede para conferir e salvar de novo. **409** com `reason`
  `BIRTH_DATE_ALREADY_SET` faz o mesmo, explicando que a data de nascimento já tinha sido informada.
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

### Eventos

- `GET /api/events` e `GET /api/me/registrations` são paginados por cursor, com "Carregar mais" como nas contas
  bloqueadas. Os horários aparecem no fuso de quem usa o app (`Intl`, sem `timeZone`); os testes fixam
  `America/Sao_Paulo` no `vite.config.ts`.
- A API guarda só publicado ou cancelado; "em andamento" e "encerrado" saem dos horários
  (`eventPhaseAt`), no instante em que o evento foi lido. Cada fase tem etiqueta em texto, não só em cor.
- No evento que ainda vai começar, `GET /api/events/{id}/registration` diz se a pessoa está inscrita.
  "Quero me inscrever" faz `PUT` (repetir é seguro) e "Cancelar inscrição" pede confirmação antes do `DELETE`.
  Cada falha esperada tem mensagem própria:
  - **403** (`reason` da ADR 0020 da duora-api): `PROFILE_INCOMPLETE` pede o perfil completo (nome, data de
    nascimento e região) e traz o link "Completar meu perfil"; `UNDERAGE` diz que os eventos são só para maiores de
    18 anos, **sem** o link, porque a data de nascimento não muda. O 403 por CSRF não chega a acontecer, porque o
    cliente HTTP sempre manda o token.
  - **409**: `EVENT_FULL`, `EVENT_CANCELLED`, `EVENT_STARTED` e `EVENT_ENDED` têm mensagem própria; o front relê o
    evento. No cancelamento, `EVENT_STARTED` e `EVENT_ENDED` também.
  - **Sem `reason`, ou com um que o front não conhece**, vale a recusa genérica do status (a API manda tratar
    assim): 403 diz que a conta não pode participar do evento e 409 lista os motivos possíveis. O `reason` é lido
    em `ApiError.refusalReason` (`UNRECOGNIZED` quando não conhecido, `null` quando ausente); um teste de tipo
    confere a lista contra a spec.
  - **503** e **429** (limite de inscrições e cancelamentos da conta): o aviso diz quantos segundos esperar pelo
    `Retry-After`, na inscrição e no cancelamento, sem apontar o motivo.
  - **404**: o evento sumiu; **401**: "Entrar de novo"; o resto: "Tente de novo".
- Durante o evento, quem está inscrito vê a dupla da **rodada atual**, que vem de `currentRound` no
  `GET /api/events/{id}` (a última rodada iniciada, de 1 a 100). Não há campo para digitar. "Rodada anterior" e
  "Rodada seguinte" andam de 1 até a atual (só aparecem com mais de uma rodada). Se a pessoa estava na rodada, a
  tela mostra a conta da dupla ou que ela ficou de fora; um 404 numa rodada já iniciada é "você não estava nela".
  Com `currentRound` `null`, a tela diz "Nenhuma rodada começou ainda". "Ver se começou outra rodada" relê o evento
  (a página não muda sozinha): quem acompanha a atual passa para a nova, quem escolheu uma anterior fica nela. A
  lista de eventos manda `currentRound` sempre `null`, porque só traz eventos que ainda vão começar. A API só manda
  o id da dupla, então a tela mostra os últimos 8 caracteres, como nas contas bloqueadas.

### Decisão privada e conexões

A regra é da API (ADR 0019 da duora-api): depois de uma rodada, cada pessoa diz em privado se quer continuar em
contato com a dupla; se as duas disserem sim, surge uma conexão.

- Quando a rodada mostra uma dupla, aparece "Continuar em contato?", com a promessa de privacidade e as duas
  opções, "Quero continuar em contato" e "Não quero", com o mesmo peso visual (botões secundários), para a tela
  não empurrar nenhuma. Quem ficou de fora ou não estava na rodada não vê o painel, e o front nem pergunta.
- A escolha pede confirmação ("A decisão é final: depois de confirmar, não dá para mudar"), com o foco no
  "Confirmar minha decisão"; "Voltar" devolve o foco à opção escolhida. Só a confirmação faz o
  `PUT .../rounds/{n}/decision` com `{"interested": ...}`.
- `GET` na mesma rota mostra a decisão já tomada (404 é "ainda não decidiu"), com a data. Depois de um "sim", o
  texto diz que a conexão aparece em Conexões **se a outra pessoa também quiser**, com o link para a lista.
- **O front nunca recebe a decisão do par, e a tela depende só da própria.** O schema guarda só `interested` e
  `decidedAt` (um teste de tipo garante que não há outro campo), a tela da decisão não lê a lista de conexões, e
  um teste mostra o mesmo texto com campos sobre o par contrabandeados na resposta e com a conexão já na lista.
- Falhas: **409** com `reason` `DECISION_ALREADY_MADE` (já tinha decidido, com a outra escolha) avisa que a decisão é
  final e relê a que vale (um 409 sem esse `reason` vira "Tente de novo", sem afirmar nada); **404**
  diz que não há o que decidir nesta rodada; **503** e **429** pedem para esperar o `Retry-After` e mantêm a
  confirmação para tentar de novo, sem dizer nada sobre o par (o 503 da API vem da espera pela decisão do par, e a
  mensagem não conta isso); **401** oferece "Entrar de novo"; o resto, "Tente de novo". Erro é `role="alert"`;
  "Decisão registrada." é `role="status"` e recebe o foco, porque o botão usado some.
- `/conexoes` lista `GET /api/me/connections` com "Carregar mais", da mais recente para a mais antiga, cada uma
  pelos últimos 8 caracteres do id da outra conta e pela data. A lista vazia explica como uma conexão surge.
  Um "sim" registrado invalida a lista em cache, que é relida quando a página abre.

### Conversa da rodada

O chat temporário com a dupla da rodada (ADR 0021 da duora-api), fatia 1 do lado web: **polling a cada 2 s**, com SSE
depois. O código está em `src/features/chat/`.

- Aparece só na **rodada atual** e só para quem formou par, abaixo da dupla e fora da região viva dela. Rodada
  anterior e quem ficou de fora não leem nada do chat.
- **Leitura.** `GET .../rounds/{n}/chat` diz se o chat aceita mensagens (`open`); depois,
  `GET .../chat/messages?afterSeq={cursor}&maxPageSize=100` traz as novas, em ordem de `seq`, e as páginas seguintes
  vêm na hora enquanto `nextAfterSeq` não for `null`. O cursor é a maior posição que **a leitura** trouxe, nunca a de
  um envio: a mensagem do par gravada logo antes da própria ainda não chegou e seria pulada. As mensagens se juntam
  por `seq`, então uma página repetida não duplica nada.
- **Só com a aba visível** (Page Visibility): a aba oculta para o polling; ao voltar, o front relê o `open` e as
  mensagens desde o cursor. Falha de leitura mostra "Sem conexão com a conversa. Tentando de novo…" e espera 4, 8,
  16 e no máximo 30 s, com até 20% a mais sorteado e nunca menos que o `Retry-After` (429 e 503). Chat fechado é lido
  até o fim e o polling para. 404 é "Não há conversa sua nesta rodada".
- **Envio.** O texto sai do campo na hora e aparece como pendente ("Enviando…"). O `POST .../chat/messages` leva uma
  `Idempotency-Key` nova (`crypto.randomUUID`) por texto, e a **mesma** chave em cada "Tentar enviar de novo" depois de
  falha de rede, erro inesperado, 429 ou 503 (com "Tente de novo em N s" quando veio o `Retry-After`). O 201 ou 200
  troca o pendente pela mensagem gravada, no mesmo item da lista.
- **Chat fechado** (`open=false` ou 409 `CHAT_CLOSED`): só leitura, sem campo, com "Esta conversa não recebe mais
  mensagens. O que foi dito continua aqui para ler." O aviso não diz o motivo, porque rodada nova, fim do evento,
  chat cheio e bloqueio chegam iguais da API, de propósito. O 409 também relê o chat. 409 `IDEMPOTENCY_KEY_REUSED`
  marca o texto como "Não foi enviada.", sem reenvio; 401 pede para entrar de novo.
- **Limite de 500 caracteres**, contados como a API conta (code points depois do NFC, sem o espaço das pontas): o
  contador fica embaixo do campo, e texto vazio ou longo demais não sai. O 400 devolve o texto ao campo com o motivo
  lido de `errors[]` (`TOO_LONG`, `FORBIDDEN_CHARACTER`, o resto como recusa genérica), a menos que a pessoa já tenha
  começado outro.
- **Acessibilidade.** A lista é `role="log"` com `aria-live="polite"` e `aria-relevant="additions"`: a mensagem nova
  é anunciada, e a própria, que continua no mesmo item quando é gravada, não é anunciada de novo. Cada mensagem diz
  quem escreveu ("Você", "Sua dupla"). O campo tem rótulo ("Sua mensagem") e o contador como descrição; **Enter
  envia, Shift+Enter quebra a linha** (Enter durante a composição de um caractere não envia). O foco fica no campo
  depois de enviar e volta a ele depois de "Tentar enviar de novo". Botões e link com 44px.
- O texto é mostrado como texto comum, com as quebras de linha, nunca como HTML ou link.

#### Denúncia de mensagem

Fatias 3 e 4 da ADR 0021 da duora-api. Código em `src/features/chat/` (`messageReport.ts`, `reportForm.ts`,
`useMessageReports.ts` e `MessageReport.tsx`) e `blockAccount` em `src/features/blocks/blockedAccounts.ts`.

- Cada mensagem **do par** tem "Denunciar", também com o chat fechado (quem bloqueou ainda pode denunciar). A
  própria mensagem e a pendente nunca oferecem a ação. O nome acessível do botão cita o começo da mensagem
  ("Denunciar a mensagem “Oi! Me passa…”", até 40 caracteres).
- O formulário abre abaixo da lista, fora da região viva, com o foco no título. Mostra a mensagem e avisa que uma
  cópia dela vai para a moderação e que denunciar não bloqueia. **Motivo** é uma lista fechada (a mesma de
  `fileReport`), com nome e explicação curta em português. **Descrição** é opcional e obrigatória em "Outro motivo".
  O contador conta como a API (code points depois do NFC, sem o espaço das pontas), até 1000. Só espaços vai como
  `null`.
- **"Também bloquear esta pessoa"** vem desmarcada. Marcada, o botão vira "Enviar denúncia e bloquear", e o
  `POST /api/accounts/{id}:block` sai **depois** do 201, com o `reportedAccountId` da resposta. Se o bloqueio falhar,
  a denúncia continua feita: um alerta diz isso e oferece "Tentar bloquear de novo" (401 pede para entrar de novo).
- **Sucesso:** a confirmação é `role="status"` e recebe o foco. A mensagem ganha a marca "Denunciada por você" e
  perde o botão. A marca vale **só nesta tela**, porque a API não diz o que a pessoa já denunciou. A troca do botão
  pela marca não é anunciada de novo pela lista (`aria-relevant="additions"`).
- **Erros:** 400 com `errors[]` vai para o campo (`description`: `REQUIRED`, `TOO_LONG`, `FORBIDDEN_CHARACTER`;
  `reason`), com o foco nele. Um 400 sem campo do formulário, 404, 429, 503, 401 e falha de rede são `role="alert"` e
  mantêm o formulário. O 429 é a cota diária (10, somando as denúncias de perfil): "Você atingiu o limite de
  denúncias de hoje. Você poderá denunciar de novo em N horas", pelo `Retry-After`. Cancelar devolve o foco ao botão
  da mensagem.

### Área da equipe (ADMIN)

O piloto precisa que a equipe opere eventos sem `curl`. As rotas são `/admin/eventos`, `/admin/eventos/novo` e
`/admin/eventos/{id}` (`src/features/admin/`).

- **Quem manda é a API.** O link **"Equipe"** (nos dois layouts, depois de "Perfil") só aparece quando `roles` de
  `GET /api/me` inclui `ADMIN`; o nome segue o "área só para a equipe" que a própria API e as telas usam. Isso é
  conforto de navegação, não proteção: quem não é ADMIN e abre o endereço recebe 403 da API, e a tela diz "Área só
  para a equipe." (no formulário, só depois do envio). A página nunca mostra dado que a API não mandou.
- **Eventos da equipe** (`/admin/eventos`). Lista `GET /api/admin/events` com "Carregar mais", do início mais distante
  ao mais antigo (ordem da API). Cada item mostra título (link para o evento), o estado em texto (rascunho, publicado,
  em andamento, encerrado ou cancelado), o horário no fuso de quem usa o app e a contagem de inscritos (nunca quem).
  O filtro "Mostrar" é um `select` (todos, rascunhos, publicados, cancelados) que vai como `?status=`, e o estado é
  mantido nas páginas seguintes. "Novo evento" leva ao formulário. Há estados de carregando, vazio (com e sem filtro),
  erro com "Tentar de novo", 401 ("Entrar de novo") e 403. Criar, publicar ou cancelar invalida a lista.
- **Novo evento.** Título (1 a 80 caracteres, uma linha), descrição (1 a 500, parágrafos com quebra de linha), início,
  fim e capacidade (2 a 200). O formulário repete as regras da duora-api para o erro aparecer antes do envio: início no
  futuro e em até 365 dias, fim depois do início e em até 12 horas dele, texto em NFC e sem caractere de controle ou
  invisível. Os horários são `datetime-local` no fuso de quem usa o app (a dica diz qual) e vão no corpo como ISO 8601
  com o deslocamento daquele dia (`2026-10-10T19:00:00-03:00`); uma hora que o horário de verão pula é recusada. No
  400, `errors: [{field, code}]` vira uma mensagem em cada campo (a tabela está em `adminEventApiProblems.ts`), o foco
  vai ao primeiro, e `code` desconhecido só marca o campo como recusado. Depois de criar, a tela abre o rascunho.
  A API não tem `Idempotency-Key` na criação (ADR 0016): se a resposta se perder, repetir pode gerar um segundo
  rascunho, e o aviso de falha diz isso.
- **O evento.** Mostra o estado guardado (rascunho, publicado ou cancelado) junto com a fase pelos horários (em
  andamento, encerrado), a contagem de inscritos (nunca quem) e "Atualizar", que relê o evento e recalcula a fase.
  "Publicar evento" (só rascunho) e "Cancelar evento" (rascunho ou publicado que ainda não acabou) pedem confirmação
  antes de enviar; o cancelamento avisa que não se desfaz. O 409 traz o `reason`: publicar (`EVENT_ALREADY_PUBLISHED`,
  `EVENT_CANCELLED`, `EVENT_STARTED`, `EVENT_ENDED`) e cancelar (`EVENT_CANCELLED`, `EVENT_ENDED`) têm mensagem própria;
  sem `reason`, ou com um desconhecido, vale a recusa genérica ("mudou ao mesmo tempo"). Depois de um 409 a tela relê
  o evento.
- **Rodadas.** Só o evento publicado e em andamento inicia rodada. O número sugerido é `currentRound + 1` do evento
  público (`GET /api/events/{id}`), ou 1; o campo aceita outro número de 1 a 100, e repetir uma rodada que já existe
  devolve a mesma, sem novo sorteio (200 em vez de 201). Iniciar pede confirmação, porque o sorteio não se desfaz.
  O resultado da rodada atual (`GET /api/admin/events/{id}/rounds/{n}`) aparece só em contagens: pares e pessoas de
  fora. `EVENT_NOT_UNDERWAY` e `ROUND_OUT_OF_SEQUENCE` têm mensagem própria; o **429** (limite de 30 rodadas por hora
  da conta) e o **503** (a mesma rodada já está sendo iniciada, ou o limite não pôde ser contado; nada foi gravado)
  têm textos diferentes e dizem quantos segundos esperar, pelo `Retry-After`.
- **Acessibilidade.** Cada campo tem rótulo, dica e erro ligados por `aria-describedby`/`aria-invalid`; o aviso de uma
  ação recebe o foco (sucesso é `status`, erro é `alert`); a confirmação recebe o foco e "Voltar" o devolve ao botão
  que a abriu; o estado do evento é texto, não só cor; todo controle tem o alvo de 44px.

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
    chat/              conversa da rodada: API, junção por posição, polling com recuo e o painel
    connections/       decisão privada depois da rodada e a lista de conexões
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

- Área da equipe (pendências para a **duora-api**):
  - **`Idempotency-Key` na criação do rascunho**, para repetir depois de uma falha de rede não criar um segundo.
  - Não há como editar um rascunho (título, horário, capacidade): errou, cancela e cria outro.
- A confirmação de ações que não se desfazem (cancelar evento, iniciar rodada) usa o botão primário, porque o tema
  ainda não tem um token de vermelho sólido com contraste testado; o Refactoring UI pede o vermelho forte nesse passo.
- A cópia da spec em `api/openapi.json` é atualizada à mão; o CI não a compara com a da duora-api, que é um
  repositório privado. Quando o contrato mudar na API, rode a atualização acima.
- Como o SWA fala com o BFF (mesma origem, Front Door ou outra saída) está em aberto e depende de decisão do
  usuário; veja [Pendência: SWA e BFF](#pendência-swa-e-bff). A CSP (`connect-src 'self'`) pressupõe a mesma origem.
- A lista de bloqueios não tem o nome nem a foto de quem foi bloqueado, porque a API não os manda.
- A dupla aparece só pelo fim do id da conta, porque a API não manda nome nem foto do par.
- A lista de eventos não mostra vagas restantes, que a API não expõe.
- A fase do evento (em andamento, encerrado) e a rodada atual são calculadas quando o evento é lido; a página não
  muda sozinha quando o evento começa ou o anfitrião inicia uma rodada com ela aberta. Durante o evento, "Ver se
  começou outra rodada" relê o evento; antes dele, é preciso recarregar a página. Um polling ou o Web PubSub
  resolveriam, e dependem de decisão.
- Conversa da rodada (ADR 0021 da duora-api):
  - **SSE** (`GET /api/me/stream`, opção (b) da ADR) no lugar do polling, quando a API tiver o stream. O protocolo de
    reconexão (cursor `afterSeq`) continua o mesmo; muda a latência.
  - Denúncia de mensagem: a marca "Denunciada por você" some ao recarregar a página, porque a API não lista as
    denúncias da pessoa. Depois do bloqueio pela denúncia, o campo de envio continua até a próxima leitura do `open`
    (envio com 409, volta à aba); o SSE resolve isso também.
  - Denúncia de mensagem: com o 401 no bloqueio, depois de entrar de novo não há onde bloquear a pessoa (a marca
    some e denunciar de novo gasta a cota). Um "Bloquear" próprio no chat depende de decisão de UX.
  - Os círculos e as caixas de marcar ficam no tamanho nativo (20px); o alvo de 44px é a linha inteira com o
    rótulo. Não foi conferido num navegador nem no celular.
  - O `open` é relido só ao abrir, ao voltar à aba e num 409. Quem só lê não vê o chat fechar quando começa a rodada
    seguinte até tentar enviar ou voltar à aba; o SSE resolve isso.
  - Se uma leitura trouxer a própria mensagem antes da resposta do envio, ela aparece por um instante duas vezes
    (a gravada e a pendente) e é anunciada de novo; a resposta do envio desfaz a duplicata.
  - O Playwright em homologação do "Pronto quando" da fatia 1 não foi feito.
- Decisão e conexões (UX, dependem de decisões da API, ADR 0019):
  - A conexão aparece só pelo fim do id e pela data; nome e foto dependem de uma API publicada do perfil. Também não
    há como chegar dela à pessoa (chat, desconectar).
  - Quem disse sim primeiro não é avisado quando a conexão se forma; precisa abrir Conexões. Um aviso depende da
    outbox e das notificações na API.
  - A decisão é final e não tem prazo. Se a API passar a aceitar mudança até um prazo, a confirmação e o 409 mudam.
  - A barra inferior do celular passou a ter cinco abas (Início, Eventos, Conexões, Perfil e Sair). Não foi conferida
    num navegador em 360px nem no aparelho; se apertar, "Conexões" pode ir para dentro do perfil.
  - Uma conexão com alguém bloqueado depois continua na lista (a API não filtra).
