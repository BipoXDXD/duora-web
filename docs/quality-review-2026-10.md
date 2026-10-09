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

6. **Máquina de estados "confirmar e devolver o foco" codificada de cinco jeitos.** `blocks/BlockedAccountsPage.tsx:115`
   (união + `wasCancelled`), `events/RegistrationPanel.tsx:148` (dois booleanos `isConfirming`/`wasKept`, contra a
   regra TS 5 de união discriminada), `admin/AdminEventActions.tsx:43` (`confirming` + `returnFocusTo`),
   `admin/AdminRoundsPanel.tsx:148` (`returnedFromConfirm`) e `connections/DecisionPanel.tsx:131` (`ChoiceStep`, a
   melhor forma). Proposta: um hook `useConfirmStep<T>()` com a união do `DecisionPanel`. Ficou de fora porque mexe
   no fluxo de cinco telas de uma vez; vale um PR próprio.
7. **Long Function em componentes de formulário.** `profile/ProfileForm.tsx:45` (~167 linhas, 6 `useState`),
   `admin/AdminNewEventPage.tsx` `NewEventForm` (~160 linhas), `chat/MessageReportForm.tsx:68` `ReportForm` (~110
   linhas, 7 `useState`) e `chat/useRoundChat.ts:30` (~150 linhas). A maior parte é JSX de campo; a lógica já mora
   em módulos puros (`profileForm.ts`, `adminEventForm.ts`, `reportForm.ts`, `chatLog.ts`). Próximo passo sugerido:
   extrair os campos de `ProfileForm` e `NewEventForm` em componentes por campo e trocar os `useState` do
   `ReportForm` por um reducer com o rascunho.
8. **Relógio.** As páginas leem `new Date()` direto (`events/EventsPage.tsx:30`, `events/MyRegistrationsPage.tsx:32`,
   `admin/AdminEventsPage.tsx:134`, `admin/AdminNewEventPage.tsx` `currentInstant`, `profile/profileForm.ts:103`), e só
   `useEventPhase`/`useEventRefresh` recebem `Clock`. Ler a hora na casca é aceitável (Testes 17); os testes fixam a
   hora com `vi.setSystemTime`. Fica registrado para quando aparecer uma terceira tela que precise do relógio
   injetado.
9. **Parse, don't validate em `blockedAt`.** `blocks/blockedAccounts.ts:9` valida `blockedAt` como string ISO e a tela
   faz `new Date(...)`; eventos, decisões e conexões usam `instantSchema` e recebem `Date`. Usar `instantSchema`
   exige movê-lo de `features/events/events.ts` para `shared/api` (hoje blocks importaria events). Pequeno, mas mexe
   no contrato interno de três features.
10. **Backoff com jitter em dois módulos.** `chat/pollDelay.ts` (jitter só para cima) e `events/refreshDelay.ts`
    (jitter simétrico) têm a mesma forma com regras diferentes. São dois usos e o jitter difere de propósito? Se
    não for de propósito, unificar com o intervalo, o teto e o jitter como parâmetros.
11. **Contagem da API depois do `trim`.** `chat/chatDraft.ts:14` (`messageLength`) e `chat/reportForm.ts:28`
    (`descriptionLength`) são `characterCount(text.trim())`. Dois usos; na terceira, mover para
    `shared/text/characterCount.ts`.

### Testes

12. **Mystery Guest.** Testes de página asseveram textos que só existem nas fixtures: `events/EventsPage.test.tsx`
    (por volta das linhas 58-113, títulos e datas de `DINNER`/`WINE`), `events/EventPage.test.tsx` (por volta de 96 e
    109-112), `events/MyRegistrationsPage.test.tsx`, `admin/AdminEventPage.test.tsx` ("de 40 vagas" vem de
    `ADMIN_DRAFT`) e `admin/AdminEventsPage.test.tsx`. Ação: assertar `DINNER.title` ou declarar o override no teste.
    São dezenas de asserts; ficou para um PR só de testes.
13. **Asserts acoplados ao estilo.** `.className).toBe(PRIMARY_BUTTON | SECONDARY_BUTTON)` em `events/EventPage.test.tsx`
    (7 vezes) e `connections/DecisionPanel.test.tsx` (3 vezes) testam a pirâmide de botões pela string inteira de
    classes; `toHaveClass('text-danger')` em `chat/MessageReport.test.tsx` (contador acima do limite). A hierarquia
    visual é o comportamento aqui e não há semântica que a exponha; manter, ou expor `data-variant` nos botões.
    `toHaveClass` de alvo de toque em `app/theme/ThemeToggle.test.tsx`, `landing/HeroInvitation.test.tsx` e
    `chat/MessageReport.test.tsx` pode usar `elementsWithoutTouchTarget` de `test/touchTarget.ts`.
14. **Seletores estruturais.** `events/EventPageLive.test.tsx` (`parentElement` + `querySelector(':scope > [role="status"]')`),
    `connections/DecisionPanel.test.tsx` (`closest('[role="status"]')`), `events/EventPage.test.tsx`
    (`closest('[aria-live]')`) e `blocks/BlockedAccountsPage.test.tsx` (`closest('li')` dentro de um helper com guarda).
    Dar nome acessível às regiões permitiria `getByRole('status', { name })`; muda a produção, então ficou registrado.
15. **Helpers que ainda se repetem.** O `render<Página>` (`stubMatchMedia` + `replaceState` + `stubApi` + `<App />`) em
    `BlockedAccountsPage.test.tsx`, `ConnectionsPage.test.tsx`, `EventsPage.test.tsx`, `MyRegistrationsPage.test.tsx`,
    `AdminEventsPage.test.tsx` e outros, candidato a `renderAppAt(path, routes)`; as respostas 429/503 com `Retry-After`
    (`busyAnswer` em `EventPage.test.tsx` e `AdminRoundsPanel.test.tsx`, `busy` em `RoundChatPanel.test.tsx` e
    `useEventRefresh.test.tsx`, `retryAfter` em `MessageReport.test.tsx`, `waitAnswer` em `DecisionPanel.test.tsx`),
    candidatas a um `busyAnswer(status, seconds)` em `test/fakeApi.ts`; e `message(seq, text, fromMe)`, igual em
    `MessageReport.test.tsx` e `RoundChatPanel.test.tsx` e com outra ordem de parâmetros em `chatLog.test.ts`. Cada um
    tem variações pequenas por arquivo; unificar pede revisar caso a caso.
16. **Type assertions.** Depois desta branch não sobra nenhum `as Tipo` nem `!` em teste ou produção (fora `as const`);
    os guardas que lançam erro substituíram os casts.

### Baixa prioridade

17. Listas sem nome acessível em `landing/HowItWorksSection.tsx` e `landing/SafetySection.tsx`; ficam sob um título de
    seção, então o impacto é baixo.
18. `features/auth/session.test.ts` mantém um `json(body: string)` próprio porque testa corpos crus (inclusive JSON
    inválido); não é a mesma regra de `jsonResponse`.
