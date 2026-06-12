import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Input } from '../components/ui';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: 'error', text: traduz(error.message) });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
      });
      if (error) setMsg({ type: 'error', text: traduz(error.message) });
      else if (data.session) setMsg({ type: 'ok', text: 'Conta criada! Agora escolha sua escola…' });
      else setMsg({ type: 'ok', text: 'Conta criada. Confirme o e-mail (se a confirmação estiver ativa) e entre para escolher sua escola.' });
    }
    setLoading(false);
  }

  async function reset() {
    if (!email) {
      setMsg({ type: 'error', text: 'Digite o e-mail primeiro.' });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg(error ? { type: 'error', text: traduz(error.message) } : { type: 'ok', text: 'Link de recuperação enviado pro e-mail.' });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
      <section className="w-full max-w-sm">
        <div className="rounded-3xl border border-white bg-white/90 p-8 shadow-soft backdrop-blur">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-600 text-3xl font-black text-white">
              h
            </div>
            <h1 className="text-2xl font-black text-slate-900">hello</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Gestão escolar — chamadas e cadastros.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' ? (
              <Field label="Nome completo">
                <div className="relative">
                  <User size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="pl-10"
                    required
                    autoComplete="name"
                  />
                </div>
              </Field>
            ) : null}
            <Field label="E-mail">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </Field>

            <Field label="Senha">
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="px-10"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Mostrar senha"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {msg ? (
              <p
                className={`rounded-xl p-3 text-sm font-semibold ${
                  msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {msg.text}
              </p>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full py-4 text-base">
              {loading ? 'Processando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button onClick={reset} className="font-bold text-slate-500 hover:text-slate-900">
              Esqueci a senha
            </button>
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setMsg(null);
              }}
              className="font-bold text-emerald-700 hover:text-emerald-900"
            >
              {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
            </button>
          </div>

          {/* Login com Google desativado por enquanto — reativar depois de configurar o OAuth. */}
        </div>
      </section>
    </main>
  );
}

function traduz(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Veja sua caixa de entrada.';
  if (m.includes('user already registered')) return 'Esse e-mail já tem conta. Faça login.';
  if (m.includes('password should be at least')) return 'A senha precisa de pelo menos 6 caracteres.';
  return msg;
}
