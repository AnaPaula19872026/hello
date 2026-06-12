import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { successToast } from '../components/Feedback';
import { Card, PageHeader } from '../components/ui';
import { cn } from '../lib/cn';
import { CONFIGURABLE_MODULES, defaultAllowed, type ModuleKey } from '../lib/permissions';
import { listPermissionSettings, savePermissionSetting } from '../lib/queries';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type AppRole } from '../lib/types';

export function PermissionsPage() {
  const { isSuperadmin, ctxLoading, refreshContext } = useAuth();
  const qc = useQueryClient();
  const { data: settings = [], isLoading } = useQuery({ queryKey: ['perm-settings'], queryFn: listPermissionSettings });

  const map = new Map(settings.map((s) => [`${s.role}|${s.module}`, s.allowed]));
  const allowedOf = (role: AppRole, module: ModuleKey) => {
    const ov = map.get(`${role}|${module}`);
    return ov !== undefined ? ov : defaultAllowed(role, module);
  };

  const save = useMutation({
    mutationFn: ({ role, module, allowed }: { role: AppRole; module: ModuleKey; allowed: boolean }) =>
      savePermissionSetting(role, module, allowed),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['perm-settings'] });
      await refreshContext(); // aplica os novos overrides no sistema todo
      successToast('Permissão atualizada');
    },
  });

  if (!ctxLoading && !isSuperadmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Centro de Permissões"
        subtitle="Defina o que cada papel pode acessar no sistema. Vale para todas as bases."
      />

      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 p-3">Papel</th>
                {CONFIGURABLE_MODULES.map((m) => (
                  <th key={m.key} className="p-3 text-center">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ASSIGNABLE_ROLES.map((role) => (
                <tr key={role} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white p-3 font-bold text-slate-800">{ROLE_LABEL[role]}</td>
                  {CONFIGURABLE_MODULES.map((m) => {
                    const on = allowedOf(role, m.key);
                    return (
                      <td key={m.key} className="p-3 text-center">
                        <button
                          onClick={() => save.mutate({ role, module: m.key, allowed: !on })}
                          disabled={save.isPending}
                          className={cn(
                            'inline-flex h-7 w-12 items-center rounded-full p-1 transition',
                            on ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-300',
                          )}
                          aria-label={`${ROLE_LABEL[role]} · ${m.label}: ${on ? 'permitido' : 'bloqueado'}`}
                        >
                          <span className="h-5 w-5 rounded-full bg-white shadow" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Dica: o <b>Administrador</b> sempre tem acesso total. As mudanças refletem para os usuários ao recarregar.
      </p>
    </>
  );
}
