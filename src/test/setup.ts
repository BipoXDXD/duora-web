import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Os testes de tela são determinísticos: a API é um dublê que responde na hora e nenhum teste de tela depende de
// tempo, então `findBy*` e `waitFor` só esperam as promises e os renders assentarem (uns 100 ms por teste numa
// máquina ociosa). O padrão de 1 s é um orçamento de relógio de parede, e com a máquina saturada (outras suítes,
// agentes, um navegador aberto) estoura sem que haja bug: o teste passa na rodada seguinte. Com folga, o caminho
// verde não fica mais lento; só a falha demora mais para ser declarada. O `testTimeout` (vite.config.ts) é maior
// que este valor, para a falha chegar com a mensagem e o DOM da Testing Library e não como "Test timed out".
const ASYNC_UTIL_TIMEOUT_MS = 5000

configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS })

afterEach(() => {
  cleanup()
})
