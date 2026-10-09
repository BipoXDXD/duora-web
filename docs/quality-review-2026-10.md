# Revisão de qualidade do front (outubro de 2026)

Revisão feita na branch `refactor/web-quality-pass`, sobre o `main` de 2026-10-08 (PR #20). O que foi refatorado está
nos commits `refactor(...)` da branch; aqui ficam só os achados **não** corrigidos, cada um com o motivo. Os caminhos
são relativos a `src/`.

## Já corrigido na branch (para referência)

| Smell | Onde estava | Ação |
|---|---|---|
| Duplicated Code: constantes de status HTTP | 13 módulos, 45 linhas `const X = 4xx` | `shared/api/httpStatus.ts` e `hasStatus()` |
| Feature Envy entre features: `usePagedList`/`READ_OPTIONS` em `events` | admin, connections, blocks, profile | `shared/api/usePagedList.ts`, `shared/api/readOptions.ts`; blocks deixou de reimplementar a paginação |
| Duplicated Code: `formatDay`, hora, `accountCode`, `waitText` | events, blocks, chat, admin | `shared/text/` |
| Duplicated Code: botão que recebe o foco de volta | 5 componentes | `shared/ui/FocusReturnButton.tsx` |
| Duplicated Code: passo de confirmação | 4 componentes | `shared/ui/ConfirmStep.tsx` |
| Duplicated Code: tipo do aviso e texto de sessão encerrada | 3 tipos, 4 textos | `shared/ui/notice.ts` |
| Duplicated Code: `ShownNotice` com contador de `id` | 5 painéis | `shared/ui/useShownNotice.ts` |
| Duplicated Code: foco no primeiro campo com problema | ProfileForm, NewEventForm | `shared/ui/focusFirstProblem.ts` |
| Large Module: `MessageReport.tsx` (480 linhas) | chat | `MessageReportForm.tsx`, `ReportConfirmation.tsx`, `blockReported.ts` |
| Magic Number: limites repetidos nas dicas dos formulários | AdminNewEventPage, ProfileForm | dicas leem as constantes |
| Mysterious Name: `value` | AdminRoundsPanel, MessageReportForm | `roundNumberText`, `option` |
| Testes: helpers duplicados (`json`, `problem`, `sentRequest`, `setVisibility`, `wait`, `callsTo`, `inSequenceOf`, `page`, `SESSION`) | ~20 arquivos de teste | `test/responses.ts`, `test/fakeVisibility.ts`, `test/fakeTimers.ts`, `test/fakeApi.ts`, `test/eventFixtures.ts` |
| Testes: `closest('li') as HTMLElement` | `features/chat/MessageReport.test.tsx` | `messageItem()` por papel `listitem` |
| Bug de teste: data real num teste de idade | `features/profile/ProfilePage.test.tsx` | `fix(profile)`: relógio fixo (quebraria em 2033-01-01) |

## Registrado, não corrigido

### Decisões que ficam para o usuário (acessibilidade e UX)

1. **Erro de ação recebe o foco ou não?** `admin/AdminNoticeMessage.tsx:16` põe o foco em sucesso **e** erro;
   `connections/DecisionPanel.tsx:102` e `events/RegistrationPanel.tsx:111` (`NoticeMessage`) só em sucesso, e o erro é
   `alert` com o foco no botão para tentar de novo. São três componentes quase iguais. Unificá-los exige escolher uma
   política (recomendo a das duas features de pessoa: erro como `alert`, foco no botão que tenta de novo) e, para
   morar em `shared/ui`, tirar `LOGIN_URL` de `features/auth` (por exemplo para `shared/routing`). Não refatorei
   porque mudaria comportamento visível no admin.
2. **Outline do alvo de foco programático.** Elementos com `tabIndex={-1}` que recebem foco usam
   `focus-visible:outline-hidden` em `shared/ui/PageFrame.tsx` e `admin/AdminNoticeMessage.tsx`, mas não em
   `blocks/BlockedAccountsPage.tsx` (`UnblockedNotice`), `profile/ProfilePage.tsx` (`SavedNotice`),
   `chat/MessageReportForm.tsx` (título) e `chat/ReportConfirmation.tsx`. Precisa de uma regra única (constante
   `FOCUS_TARGET` em `shared/ui/styles.ts`); mexe no visual, então fica para decisão.
3. **Papel da mensagem "sessão terminou".** `chat/RoundChatPanel.tsx:51` usa `role="status"`,
   `admin/AdminSignedOutNotice.tsx` usa `alert`, os avisos de decisão e inscrição usam `alert`, e o aviso do composer
   em `chat/RoundChatPanel.tsx` (perto da linha 195) não tem papel. Proposta: `alert` quando exige ação (entrar de
   novo), `status` para o informativo, documentado em `shared/ui`.
4. **Região viva aninhada.** `events/PairingPanel.tsx:112` (`aria-live="polite"`) envolve `RoundResult`, que pode
   renderizar `LoadFailure` (`role="alert"`). Alguns leitores anunciam duas vezes. Tirar o `aria-live` do wrapper
   pede checar o anúncio da dupla, que hoje depende dele; precisa de teste manual com leitor de tela.
5. **Contador de caracteres ao vivo.** Chat (`chat/RoundChatPanel.tsx`, perto da linha 281) e denúncia
   (`chat/MessageReportForm.tsx`, perto da linha 308) mostram "N de MAX caracteres"; a apresentação do perfil e a
   descrição do evento só têm a dica estática. Se virar padrão, extrair um `CharacterCounter` em `shared/ui`
   (hoje são dois usos, abaixo da Rule of Three).

### Design de código (refactor maior, sem bug)

6. **Máquina de estados "confirmar e devolver o foco" codificada de cinco jeitos.** *Feito para quatro, no PR
   `refactor/web-quality-followups`:* `shared/ui/useConfirmStep.ts` guarda a união `idle` (com o `focusOn`) /
   `confirming` (com o `subject`); `events/RegistrationPanel.tsx` (que tinha dois booleanos),
   `admin/AdminEventActions.tsx`, `admin/AdminRoundsPanel.tsx` e `connections/DecisionPanel.tsx` usam o hook.
   **Fica de fora** `blocks/BlockedAccountsPage.tsx`: ali existe um quarto estado, `failed`, e o `wasCancelled`
   sobrevive a ele, de modo que, depois de uma falha, o foco só volta ao botão se a pessoa já tinha desistido uma
   vez. A união do hook não carrega esse resto; migrar muda onde o foco cai depois de uma falha. Se for desejável
   que ele sempre volte ao botão, é uma decisão de acessibilidade (fica ao lado da 2).
7. **Long Function em componentes de formulário.** *Feito:* `profile/ProfileForm.tsx` (167 para 62 linhas na
   função) perdeu o rascunho e o salvar para `profile/useProfileEditor.ts`, e a data de nascimento e o estado viraram
   `BirthDateField` e `RegionField`; `admin/AdminNewEventPage.tsx` (`NewEventForm`) perdeu o rascunho e o envio para
   `admin/useNewEventForm.ts` (160 para 105 linhas, quase todas de campo); `chat/MessageReportForm.tsx` (`ReportForm`) trocou seis `useState` por um reducer
   puro em `chat/reportFormState.ts`, com testes (a função continua com ~100 linhas, quase só JSX); `chat/useRoundChat.ts` (150 para 45 linhas) entregou o laço de leitura
   (cursor, timer, visibilidade) a `chat/chatPolling.ts` (`startChatPolling`). Não extraí um componente por campo no
   `NewEventForm`: um `EventInput` repetiria as props de `<input>` sem um nome mais abstrato que o código.
8. **Relógio.** As páginas leem `new Date()` direto (`events/EventsPage.tsx:30`, `events/MyRegistrationsPage.tsx:32`,
   `admin/AdminEventsPage.tsx:134`, `admin/AdminNewEventPage.tsx` `currentInstant`, `profile/profileForm.ts:103`), e só
   `useEventPhase`/`useEventRefresh` recebem `Clock`. Ler a hora na casca é aceitável (Testes 17); os testes fixam a
   hora com `vi.setSystemTime`. Fica registrado para quando aparecer uma terceira tela que precise do relógio
   injetado.
9. **Parse, don't validate em `blockedAt`.** `blocks/blockedAccounts.ts:9` valida `blockedAt` como string ISO e a tela
   faz `new Date(...)`; eventos, decisões e conexões usam `instantSchema` e recebem `Date`. Usar `instantSchema`
   exige movê-lo de `features/events/events.ts` para `shared/api` (hoje blocks importaria events). Pequeno, mas mexe
   no contrato interno de três features.
10. **Backoff com jitter em dois módulos.** *Feito:* era a mesma regra (dobra por falha, teto, espalhamento, piso do
    `Retry-After`) com números diferentes. Mora em `shared/api/backoffDelay.ts`; `chat/pollDelay.ts` e
    `events/refreshDelay.ts` guardam só o intervalo, o teto e o espalhamento. A diferença do espalhamento (chat só
    para cima, eventos para os dois lados) **continua**: nada no histórico diz se é proposital, e unificar mudaria
    o texto dos testes dos dois lados. Fica registrado como parâmetro `spread`; se a diferença não tiver razão, é
    trocar dois literais.
11. **Contagem da API depois do `trim`.** `chat/chatDraft.ts:14` (`messageLength`) e `chat/reportForm.ts:28`
    (`descriptionLength`) são `characterCount(text.trim())`. Dois usos; na terceira, mover para
    `shared/text/characterCount.ts`.

### Testes

12. **Mystery Guest.** *Parcialmente feito:* os títulos, a descrição curta e o texto do horário das fixtures
    `DINNER`/`WINE`/`PICNIC`/`ADMIN_DRAFT` são lidos da fixture (`DINNER.title`, `DINNER_BLURB`, `DINNER_TIME_TEXT`
    em `test/eventFixtures.ts`) em `EventsPage`, `EventPage`, `EventPageLive`, `MyRegistrationsPage`,
    `AdminEventPage`, `AdminEventsPage` e `useEventRefresh`. **Falta:** o "de 40 vagas" e as contagens de
    inscrições (`ADMIN_DRAFT.capacity`/`registrationCount`) e o "Inscrição feita em 5 de outubro de 2026" de
    `MyRegistrationsPage` ainda são literais que vêm da fixture; e `DecisionPanel.test` afirma a data
    "10 de outubro de 2026" que vem do `DECIDED_AT` do próprio arquivo, sem o valor à vista.
13. **Asserts acoplados ao estilo.** *Feito para a pirâmide de botões:* `expectPrimaryAction`/`expectSecondaryAction`
    (`test/buttonHierarchy.ts`) substituem os dez `className).toBe(PRIMARY_BUTTON | SECONDARY_BUTTON)`; a regra
    `vitest/expect-expect` do `.oxlintrc.json` conhece os dois nomes. **Falta:** `toHaveClass('text-danger')` em
    `chat/MessageReport.test.tsx` e os `toHaveClass` de alvo de toque em `ThemeToggle`, `HeroInvitation` e
    `MessageReport`, que podem usar `elementsWithoutTouchTarget`.
14. **Seletores estruturais.** *Feito onde a produção já dá a semântica:* `BlockedAccountsPage.test` acha o item
    por `listitem` + `within`; `DecisionPanel.test` pega a região `status`; `EventPageLive.test` pega a região
    "Sua dupla" e o primeiro `status` dela; `RoundChatPanel.test` pega o `paragraph` do `listitem`. **Fica:**
    `EventPage.test` (`heading.closest('[aria-live]')`), porque o que se afirma é o aninhamento (o chat não pode
    estar dentro da região viva) e não há papel que o expresse; `RoundChatPanel.test` (`[data-message-text]`, gancho
    de teste da produção) e `MessageReport.test` (`closest('label')` do alvo de toque). Dar nome acessível às
    regiões de status continua mudando a produção.
15. **Helpers que ainda se repetem.** *Feito:* `renderAppAt(path, routes, { isDesktop })` em `test/renderApp.tsx`
    (dez arquivos); `busyAnswer(status, retryAfterSeconds?)` em `test/fakeApi.ts` (substitui `busyAnswer`, `busy`,
    `retryAfter` e `waitAnswer`); `message(seq, text, fromMe)` em `test/chatFixtures.ts` (as duas suítes do chat).
    `Navigation.test` (devolve também a `navigation`) e `SessionControls.test` (sem caminho) ficam com o `render`
    próprio. O `message` de `chatLog.test.ts` fica: constrói o `ChatMessage` já lido (com `Date`), não o corpo da API.
16. **Type assertions.** Depois desta branch não sobra nenhum `as Tipo` nem `!` em teste ou produção (fora `as const`);
    os guardas que lançam erro substituíram os casts.

### Baixa prioridade

17. Listas sem nome acessível em `landing/HowItWorksSection.tsx` e `landing/SafetySection.tsx`; ficam sob um título de
    seção, então o impacto é baixo.
18. `features/auth/session.test.ts` mantém um `json(body: string)` próprio porque testa corpos crus (inclusive JSON
    inválido); não é a mesma regra de `jsonResponse`.
