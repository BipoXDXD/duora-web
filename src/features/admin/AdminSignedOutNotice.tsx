import { SIGNED_OUT_NOTICE } from '../../shared/ui/notice.ts'
import { SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'

/** A API respondeu 401 no meio do uso: a sessão acabou, e entrar de novo traz a pessoa de volta. */
export function AdminSignedOutNotice() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p role="alert" className="text-fg">
        {SIGNED_OUT_NOTICE.text}
      </p>
      <a href={LOGIN_URL} className={SECONDARY_BUTTON}>
        Entrar de novo
      </a>
    </div>
  )
}
