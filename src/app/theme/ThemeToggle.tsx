import { useThemeChoice } from './useThemeChoice.ts'

/** O nome diz a ação ("Usar tema claro"), não o estado, para o leitor de tela saber o que o clique faz. */
export function ThemeToggle() {
  const { theme, switchTheme } = useThemeChoice()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={switchTheme}
      aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        {isDark ? <SunPaths /> : <MoonPath />}
      </svg>
    </button>
  )
}

function SunPaths() {
  return (
    <>
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
      />
    </>
  )
}

function MoonPath() {
  return <path strokeLinejoin="round" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
}
