import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { successToast } from './Feedback';
import { Button, Card, Select } from './ui';
import { decideAccessRequest, listAccessRequests } from '../lib/queries';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type AccessRequest, type AppRole } from '../lib/types';

/** Fila de solicitações de acesso pendentes — o admin aprova (com papel) ou recusa. */
export function AccessRequestsQueue() {
  const { data: reqs = [], isLoading } = useQuery({
    queryKey: ['access-requests', 'pending'],
    queryFn: () => listAccessRequests('pending'),
    refetchInterval: 30000,
    retry: false,
  });

  if (isLoading || reqs.length === 0) return null; // não polui quando não há nada

  return (
    <Card className="mb-5 border-amber-200 bg-amber-50/40">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Clock size={18} />
        </span>
        <div>
          <h2 className="font-black text-slate-900">Solicitações de acesso</h2>
          <p className="text-xs font-bold text-slate-500">{reqs.length} pessoa(s) aguardando liberação</p>
        </div>
      </div>
      <div className="space-y-2">
        {reqs.map((r) => (
          <RequestRow key={r.id} req={r} />
        ))}
      </div>
    </Card>
  );
}

function RequestRow({ req }: { req: AccessRequest }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<AppRole>(req.requested_role === 'superadmin' ? 'professor' : req.requested_role);

  const decide = useMutation({
    mutationFn: (approve: boolean) => decideAccessRequest(req.id, approve, role),
    onSuccess: (_d, approve) => {
      qc.invalidateQueries({ queryKey: ['access-requests'] });
      qc.invalidateQueries({ queryKey: ['org-admin'] });
      successToast(approve ? 'Acesso liberado' : 'Solicitação recusada');
    },
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <UserPlus size={16} className="shrink-0 text-emerald-600" />
        <span className="font-black text-slate-900">{req.full_name || req.email || 'Usuário'}</span>
        {req.email ? <span className="text-xs font-bold text-slate-400">{req.email}</span> : null}
      </div>
      <p className="mt-0.5 text-xs font-bold text-slate-500">
        {req.org_name} · pediu como {ROLE_LABEL[req.requested_role]}
      </p>
      {req.note ? <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600">{req.note}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-slate-500">Liberar como</label>
        <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className="h-10 w-auto py-2">
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="danger" onClick={() => decide.mutate(false)} disabled={decide.isPending}>
            <X size={16} /> Recusar
          </Button>
          <Button onClick={() => decide.mutate(true)} disabled={decide.isPending}>
            <Check size={16} /> {decide.isPending ? '…' : 'Aprovar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
