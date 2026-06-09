import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Field, Input, PageHeader } from '../components/ui';
import { getProfile, updateProfile } from '../lib/queries';
import { signOut } from '../lib/supabase';

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

  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <>
      <PageHeader title="Configurações" subtitle="Seus dados, conta Google e calendário." />

      <div className="space-y-5">
        {/* Conta Google */}
        <Card>
          <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">Conta Google</h2>
          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-xl font-black uppercase text-white">
                {(name || user?.email || '?').slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">{name || 'Usuária'}</p>
              <p className="flex items-center gap-1 text-sm text-emerald-700">
                <ShieldCheck size={14} /> {user?.email}
              </p>
            </div>
          </div>
          <a
            href="https://myaccount.google.com/security"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            Gerenciar conta e senha no Google <ExternalLink size={14} />
          </a>
        </Card>

        {/* Dados pessoais */}
        <Card>
          <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">Dados pessoais</h2>
          <div className="space-y-4">
            <Field label="Nome de exibição">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="E-mail (vinculado ao Google)">
              <Input value={user?.email ?? ''} disabled className="bg-slate-50 text-slate-500" />
            </Field>
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
