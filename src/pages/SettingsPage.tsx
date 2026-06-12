import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ImagePlus, KeyRound, LogOut, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL, type School } from '../lib/types';
import { Button, Card, Field, Input, PageHeader } from '../components/ui';
import { successToast } from '../components/Feedback';
import { can } from '../lib/permissions';
import { fileToCompressedDataUrl } from '../lib/image';
import { getProfile, listSchools, saveSchool, updateProfile } from '../lib/queries';
import { signOut, supabase } from '../lib/supabase';

export function SettingsPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const [name, setName] = useState('');
  const [calendarUrl, setCalendarUrl] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? '');
      setCalendarUrl(profile.calendar_url ?? '');
      setAvatar(profile.avatar_url ?? null);
    }
  }, [profile]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoErr('');
    try {
      // foto de perfil: 192px, JPEG (leve)
      setAvatar(await fileToCompressedDataUrl(file, 192, 0.72, true));
    } catch (err) {
      setPhotoErr((err as Error).message);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      await updateProfile(user!.id, { full_name: name.trim(), calendar_url: calendarUrl.trim() || null, avatar_url: avatar });
      // Atualiza também o nome no auth (usado na saudação e no menu).
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', user?.id] });
      successToast('Dados salvos com sucesso');
    },
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
      successToast('Senha alterada com sucesso');
    },
  });

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Seus dados, senha e calendário."
        action={
          role ? (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">
              {ROLE_LABEL[role]}
            </span>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Dados pessoais */}
        <Card>
          <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">Dados pessoais</h2>

          {/* Foto de perfil */}
          <div className="mb-5 flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="" className="h-20 w-20 shrink-0 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-emerald-600 text-2xl font-black uppercase text-white">
                {(name || user?.email || '?').slice(0, 1)}
              </div>
            )}
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                <ImagePlus size={18} /> {avatar ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
              {avatar ? (
                <button type="button" onClick={() => setAvatar(null)} className="ml-2 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-red-600">
                  <X size={14} /> Remover
                </button>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">Foto sua ou qualquer imagem. Fica leve e salva no banco.</p>
              {photoErr ? <p className="mt-1 text-xs font-semibold text-red-600">{photoErr}</p> : null}
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Nome de exibição">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="E-mail de acesso">
              <Input value={user?.email ?? ''} disabled className="bg-slate-50 text-slate-500" />
            </Field>
          </div>
        </Card>

        {/* Dados da escola (base de uma escola só) */}
        {can(role, 'escolas') ? <SchoolSettingsCard /> : null}

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

/** Edição dos dados da escola quando a base tem exatamente uma escola
 *  (substitui o cadastro "Escolas" no caso comum de uma escola por base). */
function SchoolSettingsCard() {
  const qc = useQueryClient();
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const school = schools.length === 1 ? schools[0] : null;

  const [form, setForm] = useState<Partial<School>>({});
  const [logo, setLogo] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name,
        director: school.director ?? '',
        address: school.address ?? '',
        phone: school.phone ?? '',
        inep: school.inep ?? '',
        city: school.city ?? '',
      });
      setLogo(school.logo_url ?? null);
    }
  }, [school]);

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    try {
      setLogo(await fileToCompressedDataUrl(file, 256, 0.8, false));
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  const save = useMutation({
    mutationFn: () => saveSchool({ id: school!.id, name: (form.name || '').trim() || school!.name, ...form, logo_url: logo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      successToast('Dados da escola salvos');
    },
  });

  // Só faz sentido quando a base tem UMA escola (rede usa o menu Escolas).
  if (schools.length !== 1) return null;

  const set = (k: keyof School) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
        <Building2 size={16} /> Dados da escola
      </h2>
      <p className="mb-4 text-xs text-slate-400">Aparecem no cabeçalho dos relatórios (logo, diretor, endereço).</p>

      <div className="mb-5 flex items-center gap-4">
        {logo ? (
          <img src={logo} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <Building2 size={24} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
            <ImagePlus size={16} /> {logo ? 'Trocar logo' : 'Enviar logo'}
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </label>
          {logo ? (
            <button onClick={() => setLogo(null)} className="text-left text-xs font-bold text-red-600">
              Remover logo
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da escola">
          <Input value={form.name ?? ''} onChange={set('name')} />
        </Field>
        <Field label="Diretor(a)">
          <Input value={form.director ?? ''} onChange={set('director')} />
        </Field>
        <Field label="Endereço">
          <Input value={form.address ?? ''} onChange={set('address')} />
        </Field>
        <Field label="Cidade">
          <Input value={form.city ?? ''} onChange={set('city')} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone ?? ''} onChange={set('phone')} />
        </Field>
        <Field label="Código INEP">
          <Input value={form.inep ?? ''} onChange={set('inep')} />
        </Field>
      </div>
      {err ? <p className="mt-2 text-sm font-semibold text-red-600">{err}</p> : null}
      {save.isError ? <p className="mt-2 text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
      <div className="mt-4">
        <Button variant="soft" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar dados da escola'}
        </Button>
      </div>
    </Card>
  );
}
