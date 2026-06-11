import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, LogIn, Network, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { successToast } from '../components/Feedback';
import { AddButton, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { addMember, createOrganization, listOrganizations, listOrgMembers } from '../lib/queries';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type AppRole, type Organization } from '../lib/types';

export function OrganizationsPage() {
  const { isSuperadmin, activeOrgId, switchOrg, ctxLoading } = useAuth();
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [membersOf, setMembersOf] = useState<Organization | null>(null);

  const create = useMutation({
    mutationFn: () => createOrganization(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      setNewOpen(false);
      setName('');
      successToast('Organização criada com sucesso');
    },
  });

  if (!ctxLoading && !isSuperadmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Organizações"
        subtitle="Clientes do sistema. Cada organização tem suas escolas, turmas e usuários."
        action={<AddButton onClick={() => setNewOpen(true)} label="Nova organização" />}
      />

      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : orgs.length === 0 ? (
        <EmptyState icon={<Network size={26} />} title="Nenhuma organização" hint="Crie a primeira para começar a vender." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orgs.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-900">{o.name}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-400">
                    {o.is_demo ? 'Demonstração · ' : ''}
                    {o.plan}
                    {o.id === activeOrgId ? ' · ativa' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setMembersOf(o)}>
                  <UserPlus size={16} /> Membros
                </Button>
                <Button
                  variant={o.id === activeOrgId ? 'soft' : 'primary'}
                  className="flex-1"
                  disabled={o.id === activeOrgId}
                  onClick={() => switchOrg(o.id).then(() => successToast(`Entrou em ${o.name}`))}
                >
                  <LogIn size={16} /> {o.id === activeOrgId ? 'Atual' : 'Entrar'}
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
          <div className="flex justify-end gap-2">
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
    </>
  );
}

function MembersModal({ org, onClose }: { org: Organization; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', org.id],
    queryFn: () => listOrgMembers(org.id),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('professor');

  const add = useMutation({
    mutationFn: () => addMember(org.id, email.trim(), role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members', org.id] });
      setEmail('');
      successToast('Membro adicionado com sucesso');
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
                <div key={m.user_id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{m.full_name || m.email || m.user_id}</p>
                    {m.email ? <p className="truncate text-xs text-slate-400">{m.email}</p> : null}
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{ROLE_LABEL[m.role]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
