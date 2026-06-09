import { Chrome, Eye, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { signInWithGoogle, supabase } from '../../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function login() {
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage(error.message);
  }

  async function createAccount() {
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    setMessage(error ? error.message : 'Conta criada. Verifique seu e-mail para confirmar o acesso.');
  }

  async function resetPassword() {
    if (!email) {
      setMessage('Informe o e-mail antes de recuperar a senha.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMessage(error ? error.message : 'Enviamos o link de recuperação para seu e-mail.');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center">
        <div className="rounded-lg border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-lg bg-emerald-600 text-2xl font-black text-white">h</div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">hello</h1>
            <p className="text-sm text-slate-500">Controle de presença escolar em menos de 10 segundos.</p>
          </div>
          <button onClick={signInWithGoogle} className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg bg-slate-950 px-4 py-4 text-base font-bold text-white active:scale-[.99]">
            <Chrome size={20} />
            Entrar com Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs uppercase text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> ou e-mail <span className="h-px flex-1 bg-slate-200" />
          </div>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
            <Mail size={18} />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" className="w-full bg-transparent outline-none" />
          </label>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
            <Lock size={18} />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={show ? 'text' : 'password'} placeholder="Senha" className="w-full bg-transparent outline-none" />
            <button type="button" onClick={() => setShow(!show)} aria-label="Mostrar senha">
              <Eye size={18} />
            </button>
          </label>
          {message ? <p className="mb-3 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">{message}</p> : null}
          <button onClick={login} disabled={loading} className="w-full rounded-lg bg-emerald-600 px-4 py-4 font-black text-white disabled:opacity-60">
            {loading ? 'Processando...' : 'Entrar'}
          </button>
          <div className="mt-4 flex justify-between gap-3 text-sm text-slate-500">
            <button onClick={resetPassword} className="font-bold hover:text-slate-950">Esqueci minha senha</button>
            <button onClick={createAccount} className="font-bold hover:text-slate-950">Criar conta</button>
          </div>
        </div>
      </section>
    </main>
  );
}
