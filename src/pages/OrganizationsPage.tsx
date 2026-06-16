import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, GraduationCap, ImagePlus, LogIn, Network, Pencil, Plus, Power, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AccessRequestsQueue } from '../components/AccessRequestsQueue';
import { successToast } from '../components/Feedback';
import { AddButton, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { fileToCompressedDataUrl } from '../lib/image';
import {
  addMember,
  createOrganization,
  deleteOrganization,
  listOrgAdmin,
  listOrgMembers,
  removeMember,
  setMemberRole,
  setOrgActive,
  updateOrganization,
  type OrgAdmin,
} from '../lib/queries';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type AppRole } from '../lib/types';

type Filter = 'todas' | 'ativas' | 'inativas';

export function OrganizationsPage() {
  const { isSuperadmin, activeOrgId, switchOrg, ctxLoading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['org-admin'], queryFn: listOrgAdmin });

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [membersOf, setMembersOf] = useState<OrgAdmin | null>(null);
  const [editOf, setEditOf] = useState<OrgAdmin | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');

  const create = useMutation({
    mutationFn: async () => {
      const id = await createOrganization(name.trim());
      await switchOrg(id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      setNewOpen(false);
      setName('');
      successToast('Organização criada — você já está dentro dela');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setOrgActive(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      successToast('Status atualizado');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admin'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      successToast('Organização excluída');
    },
    onError: (e) => alert((e as Error).message),
  });

  function confirmDelete(o: OrgAdmin) {
    const ok = confirm(
      `EXCLUIR "${o.name}"?\n\nIsso apaga DEFINITIVAMENTE todos os dados do cliente: ${o.schools} escola(s), ${o.students} aluno(s), turmas, notas, avisos, planejamentos e membros.\n\nEsta ação é irreversível.`,
    );
    if (ok) remove.mutate(o.id);
  }

  const counts = useMemo(
    () => ({ todas: orgs.length, ativas: orgs.filter((o) => o.active).length, inativas: orgs.filter((o) => !o.active).length }),
    [orgs],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orgs
      .filter((o) => (filter === 'ativas' ? o.active : filter === 'inativas' ? !o.active : true))
      .filter((o) => !term || o.name.toLowerCase().includes(term));
  }, [orgs, q, filter]);

  if (!ctxLoading && !isSuperadmin) return <Navigate to="/" replace />;

  async function enter(o: OrgAdmin) {
    await switchOrg(o.id);
    successToast(`Você está em ${o.name}`);
    nav('/');
  }

  const tiles: { key: Filter; label: string; n: number; cls: string }[] = [
    { key: 'todas', label: 'Todas as organizações', n: counts.todas, cls: 'border-slate-200 bg-white text-slate-700' },
    { key: 'ativas', label: 'Ativas', n: counts.ativas, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { key: 'inativas', label: 'Inativas', n: counts.inativas, cls: 'border-red-200 bg-red-50 text-red-700' },
  ];

  return (
    <>
      <PageHeader
        title="Organizações"
        subtitle="Gerenciamento dos clientes contratantes."
        action={<AddButton onClick={() => setNewOpen(true)} label="Nova organização" />}
      />

      {/* Fila de aprovação de novos cadastros */}
      <AccessRequestsQueue />

      {/* Busca */}
      <SearchInput value={q} onChange={setQ} placeholder="Pesquisar organização…" className="mb-4" />

      {/* Resumo / filtros */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
              t.cls,
              filter === t.key ? 'ring-2 ring-emerald-400' : 'opacity-90 hover:opacity-100',
            )}
          >
            <span className="text-sm font-bold">{t.label}</span>
            <span className="text-2xl font-black">{t.n}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={<Network size={26} />} title="Nenhuma organização" hint="Crie o primeiro cliente ou ajuste a busca." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                {o.logo_url ? (
                  <img src={o.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Building2 size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black text-slate-900">{o.name}</p>
                    {o.id === activeOrgId ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">atual</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{o.cnpj || (o.is_demo ? 'Demonstração' : 'CNPJ não informado')}</p>
                </div>
                <button
                  onClick={() => setEditOf(o)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Editar"
                >
                  <Pencil size={15} />
                </button>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase',
                    o.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                  )}
                >
                  {o.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* Métricas */}
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5">
                  <Building2 size={14} /> {o.schools} escola(s)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5">
                  <GraduationCap size={14} /> {o.students} aluno(s)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5">
                  <Users size={14} /> {o.members} membro(s)
                </span>
              </div>

              {/* Ações */}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button variant="primary" className="flex-1" onClick={() => enter(o)}>
                  <LogIn size={16} /> Acessar
                </Button>
                <Button variant="ghost" onClick={() => setMembersOf(o)}>
                  <UserPlus size={16} /> Membros
                </Button>
                <Button
                  variant={o.active ? 'danger' : 'soft'}
                  onClick={() => {
                    if (confirm(`${o.active ? 'Inativar' : 'Ativar'} "${o.name}"?`)) toggleActive.mutate({ id: o.id, active: !o.active });
                  }}
                  aria-label={o.active ? 'Inativar' : 'Ativar'}
                  title={o.active ? 'Inativar' : 'Ativar'}
                >
                  <Power size={16} />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => confirmDelete(o)}
                  disabled={remove.isPending}
                  aria-label="Excluir organização"
                  title="Excluir organização"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Criar organização */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nova organização">
        <div className="space-y-4">
          <Field label="Nome do cliente (escola ou rede)">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Colégio Aurora" autoFocus />
          </Field>
          <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
              <Plus size={16} /> {create.isPending ? 'Criando…' : 'Criar'}
            </Button>
          </div>
          {create.isError ? <p className="text-sm font-semibold text-red-600">{(create.error as Error).message}</p> : null}
        </div>
      </Modal>

      {membersOf ? <MembersModal org={membersOf} onClose={() => setMembersOf(null)} /> : null}
      {editOf ? <EditOrgModal org={editOf} onClose={() => setEditOf(null)} /> : null}
    </>
  );
}

function EditOrgModal({ org, onClose }: { org: OrgAdmin; onClose: () => void }) {
  const qc = useQueryClient();
  const { refreshContext } = useAuth();
  const [name, setName] = useState(org.name);
  const [cnpj, setCnpj] = useState(org.cnpj ?? '');
  const [logo, setLogo] = useState<string | null>(org.logo_url ?? null);
  const [err, setErr] = useState('');

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
    mutationFn: () => updateOrganization(org.id, { name: name.trim(), cnpj: cnpj.trim() || null, logo_url: logo }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['org-admin'] });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      await refreshContext(); // propaga o novo nome no menu/sistema
      onClose();
      successToast('Organização atualizada com sucesso');
    },
  });

  return (
    <Modal open onClose={onClose} title="Editar organização">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400">
              <Building2 size={24} />
            </div>
          )}
          <div className="flex flex-col gap-2">
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
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="CNPJ">
          <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
        </Field>
        {err ? <p className="text-sm font-semibold text-red-600">{err}</p> : null}
        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MembersModal({ org, onClose }: { org: OrgAdmin; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', org.id],
    queryFn: () => listOrgMembers(org.id),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('professor');

  const refreshMembers = () => qc.invalidateQueries({ queryKey: ['org-members', org.id] });

  const add = useMutation({
    mutationFn: () => addMember(org.id, email.trim(), role),
    onSuccess: () => {
      refreshMembers();
      setEmail('');
      successToast('Membro adicionado com sucesso');
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: AppRole }) => setMemberRole(org.id, userId, newRole),
    onSuccess: () => {
      refreshMembers();
      successToast('Papel atualizado com sucesso');
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(org.id, userId),
    onSuccess: () => {
      refreshMembers();
      successToast('Membro removido com sucesso');
    },
  });

  return (
    <Modal open onClose={onClose} title={`Membros — ${org.name}`} size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">Adicionar membro</p>
          <p className="mb-3 text-xs text-slate-500">A pessoa precisa já ter conta no sistema (cadastro por e-mail/senha).</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@pessoa.com" type="email" className="flex-1" />
            <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="sm:w-56">
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Button onClick={() => add.mutate()} disabled={!email.trim() || add.isPending}>
              <UserPlus size={16} /> Adicionar
            </Button>
          </div>
          {add.isError ? <p className="mt-2 text-sm font-semibold text-red-600">{(add.error as Error).message}</p> : null}
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">Membros ({members.length})</p>
          {isLoading ? (
            <p className="text-slate-400">Carregando…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum membro ainda.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{m.full_name || m.email || m.user_id}</p>
                    {m.email ? <p className="truncate text-xs text-slate-400">{m.email}</p> : null}
                  </div>
                  <Select
                    value={m.role}
                    onChange={(e) => changeRole.mutate({ userId: m.user_id, newRole: e.target.value as AppRole })}
                    className="w-40 shrink-0 py-2 text-xs"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={() => {
                      if (confirm(`Remover ${m.full_name || m.email} desta organização?`)) remove.mutate(m.user_id);
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    aria-label="Remover membro"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
