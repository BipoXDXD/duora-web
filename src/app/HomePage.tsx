import { JoinWaitlistForm } from '../features/waitlist/JoinWaitlistForm.tsx'

export function HomePage() {
  return (
    <section aria-labelledby="home-title" className="flex max-w-xl flex-col gap-8">
      <div>
        <h1 id="home-title" className="text-3xl font-semibold tracking-tight text-fg md:text-5xl">
          Encontros por experiências e minijogos compartilhados.
        </h1>
        <p className="mt-4 text-lg text-fg-muted">
          O Duora está chegando. Entre na lista de espera para saber quando abrirmos.
        </p>
      </div>
      <JoinWaitlistForm />
    </section>
  )
}
