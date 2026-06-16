import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, RefreshCw, School, Send, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { successToast } from '../components/Feedback';
import { Button, Field, Select, Loading} from '../components/ui';
import { listJoinOrgs, myAccessRequest, requestAccess } from '../lib/queries';
import { signOut } from '../lib/supabase';

/**
 * Mostrado quando o usuário está autenticado mas ainda NÃO tem vínculo com
 * nenhuma escola: escolhe a escola + papel desejado e aguarda a liberação do
 * administrador. Some sozinho assim que o vínculo é criado (aprovação).
 */
export function AccessRequestGate() {
  const { user, refreshContext } = useAuth();
  const qc = useQueryClient();
  const { data: req, isLoading } = useQuery({
    queryKey: ['my-access-request', user?.id],
    queryFn: myAccessRequest,
    refetchInterval: 20000, // detecta a liberação sem precisar recarregar
    retry: false,
  });

  // Quando aprovado, o vínculo já existe — atualiza o contexto e o portão fecha.
  useEffect(() => {
    if (req?.status === 'approved') refreshContext(true);
  }, [req?.status, refreshContext]);

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
      <section className="w-full max-w-md">
        <div className="rounded-3xl border border-white bg-white/90 p-8 shadow-soft backdrop-blur">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">h</div>
            <h1 className="text-xl font-black text-slate-900">Quase lá!</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{user?.email}</p>
          </div>

          {isLoading ? (
            <Loading />
          ) : req?.status === 'pending' ? (
            <Waiting onRefresh={() => qc.invalidateQueries({ queryKey: ['my-access-request', user?.id] }).then(() => refreshContext())} />
          ) : (
            <RequestForm rejected={req?.status === 'rejected'} onDone={() => qc.invalidateQueries({ queryKey: ['my-access-request', user?.id] })} />
          )}

          <button onClick={() => signOut()} className="mx-auto mt-6 flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-700">
            <LogOut size={15} /> Sair / trocar de conta
          </button>
        </div>
      </section>
    </main>
  );
}

function Waiting({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-amber-500">
        <Clock size={30} />
      </div>
      <div>
        <h2 className="text-lg font-black text-slate-800">Aguardando liberação</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
          Seu cadastro foi enviado. Assim que o administrador liberar seu acesso, esta tela abre o sistema automaticamente.
        </p>
      </div>
      <Button variant="ghost" onClick={onRefresh} className="mx-auto">
        <RefreshCw size={16} /> Já fui liberado? Atualizar
      </Button>
    </div>
  );
}

function RequestForm({ rejected, onDone }: { rejected: boolean; onDone: () => void }) {
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['join-orgs'], queryFn: listJoinOrgs, retry: false });
  const [orgId, setOrgId] = useState('');
  const [note, setNote] = useState('');

  const send = useMutation({
    mutationFn: () => requestAccess(orgId, 'professor', note),
    onSuccess: () => {
      successToast('Solicitação enviada!');
      onDone();
    },
  });

  return (
    <div className="space-y-4">
      {rejected ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <span>Sua solicitação anterior foi recusada. Você pode revisar os dados e enviar de novo.</span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Escolha sua escola e a função. O administrador vai revisar e liberar seu acesso.</p>
      )}

      <Field label="Escola">
        <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">{isLoading ? 'Carregando…' : 'Selecione a escola'}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Mensagem ao administrador (opcional)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Ex.: sou professora do 5º ano, turma B."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </Field>

      {send.isError ? <p className="text-sm font-semibold text-red-600">{(send.error as Error).message}</p> : null}
      {!isLoading && orgs.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-slate-400"><School size={15} /> Nenhuma escola disponível. Fale com o administrador.</p>
      ) : null}

      <Button onClick={() => send.mutate()} disabled={!orgId || send.isPending} className="w-full">
        <Send size={16} /> {send.isPending ? 'Enviando…' : 'Solicitar acesso'}
      </Button>
    </div>
  );
}
