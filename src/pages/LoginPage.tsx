import { signInWithGoogle } from '../lib/supabase';

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
      <section className="w-full max-w-sm">
        <div className="rounded-3xl border border-white bg-white/90 p-8 text-center shadow-soft backdrop-blur">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-600 text-3xl font-black text-white">
            h
          </div>
          <h1 className="text-2xl font-black text-slate-900">hello</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Chamadas, cadastros e calendário escolar — simples e na nuvem.
          </p>

          <button
            onClick={() => signInWithGoogle()}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-base font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[.99]"
          >
            <GoogleIcon />
            Entrar com Google
          </button>

          <p className="mt-6 text-xs text-slate-400">
            Ao continuar você concorda em usar sua conta Google para acessar o sistema.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 41.5 44 38 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
