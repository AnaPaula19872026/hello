import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Field, Input, PageHeader } from '../components/ui';
import { getProfile, updateProfile } from '../lib/queries';
import { signOut, supabase } from '../lib/supabase';

export function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const [name, setName] = useState('');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? '');
      setCalendarUrl(profile.calendar_url ?? '');
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updateProfile(user!.id, { full_name: name.trim(), calendar_url: calendarUrl.trim() || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  });

  const changePwd = useMutation({
    mutationFn: async () => {
      if (pwd.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
      if (pwd !== pwd2) throw new Error('As senhas não conferem.');
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPwd('');
      setPwd2('');
    },
  });

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Seus dados, senha e calendário."
        action={
          profile?.role === 'master' ? (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">
              Administrador master
            </span>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Dados pessoais */}
        <Card>
          <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">Dados pessoais</h2>
          <div className="space-y-4">
            <Field label="Nome de exibição">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="E-mail de acesso">
              <Input value={user?.email ?? ''} disabled className="bg-slate-50 text-slate-500" />
            </Field>
          </div>
        </Card>

        {/* Senha */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
            <KeyRound size={16} /> Trocar senha
          </h2>
          <div className="space-y-4">
            <Field label="Nova senha">
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
            </Field>
            <Field label="Confirmar nova senha">
              <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
            </Field>
            {changePwd.isError ? <p className="text-sm font-semibold text-red-600">{(changePwd.error as Error).message}</p> : null}
            {changePwd.isSuccess ? <p className="text-sm font-semibold text-emerald-700">Senha alterada com sucesso.</p> : null}
            <Button variant="soft" onClick={() => changePwd.mutate()} disabled={changePwd.isPending || !pwd}>
              {changePwd.isPending ? 'Salvando…' : 'Atualizar senha'}
            </Button>
          </div>
        </Card>

        {/* Google Agenda */}
        <Card>
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Google Agenda</h2>
          <p className="mb-4 text-sm text-slate-500">
            No Google Agenda → Configurações → sua agenda → “Integrar agenda”, copie o link em <strong>Incorporar código</strong>{' '}
            (o endereço dentro de <code>src="…"</code>) e cole abaixo.
          </p>
          <Field label="Link de incorporação">
            <Input
              value={calendarUrl}
              onChange={(e) => setCalendarUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/embed?src=…"
            />
          </Field>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isSuccess && !save.isPending ? (
              <>
                <Check size={18} /> Salvo
              </>
            ) : save.isPending ? (
              'Salvando…'
            ) : (
              'Salvar alterações'
            )}
          </Button>
          <Button variant="danger" onClick={() => signOut()}>
            <LogOut size={18} /> Sair da conta
          </Button>
        </div>
        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
      </div>
    </>
  );
}
