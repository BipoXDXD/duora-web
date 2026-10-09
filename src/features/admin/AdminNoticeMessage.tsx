import { PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import type { AdminNotice } from './adminNotices.ts'

interface AdminNoticeMessageProps {
  readonly notice: AdminNotice
  /** Falso quando o foco já foi para um campo com erro: o aviso é lido como alerta, sem tirá-lo de lá. */
  readonly takesFocus?: boolean
}

/**
 * O aviso de uma ação da equipe. Recebe o foco ao aparecer (a chave do elemento muda a cada resposta), porque
 * o botão usado costuma sumir ou virar outro: sucesso é `status` e erro é `alert`.
 */
export function AdminNoticeMessage({ notice, takesFocus = true }: AdminNoticeMessageProps) {
  const ref = useFocusOnMount<HTMLDivElement>()
  const isSuccess = notice.tone === 'success'
  return (
    <div
      ref={takesFocus ? ref : undefined}
      tabIndex={-1}
      role={isSuccess ? 'status' : 'alert'}
      className={
        isSuccess
          ? 'w-full rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle focus-visible:outline-hidden'
          : 'flex flex-col items-start gap-3 font-semibold text-danger focus-visible:outline-hidden'
      }
    >
      <p>{notice.text}</p>
      {notice.action === 'signIn' && (
        <a href={LOGIN_URL} className={PRIMARY_BUTTON}>
          Entrar de novo
        </a>
      )}
    </div>
  )
}
