import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setActiveOrgIdRef } from '../lib/org';
import { listMyMemberships, listOrganizations, setActiveOrg } from '../lib/queries';
import { supabase } from '../lib/supabase';
import type { AppRole, Membership, Organization, Profile } from '../lib/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  // Contexto SaaS
  profile: Profile | null;
  memberships: Membership[];
  organizations: Organization[];
  activeOrgId: string | null;
  role: AppRole | null; // papel na organização ativa
  isSuperadmin: boolean;
  ctxLoading: boolean;
  switchOrg: (orgId: string) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  profile: null,
  memberships: [],
  organizations: [],
  activeOrgId: null,
  role: null,
  isSuperadmin: false,
  ctxLoading: true,
  switchOrg: async () => {},
  refreshContext: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [ctxLoading, setCtxLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  // silent=true: atualização de fundo (foco/intervalo) — NÃO mostra o spinner global,
  // senão a tela "pisca" e tira o usuário do que está fazendo.
  const refreshContext = useCallback(
    async (silent = false) => {
      if (!userId) {
        setProfile(null);
        setMemberships([]);
        setOrganizations([]);
        setActiveOrgIdRef(null);
        setCtxLoading(false);
        return;
      }
      if (!silent) setCtxLoading(true);
      try {
        const [{ data: prof }, mems, orgs] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          listMyMemberships(userId).catch(() => [] as Membership[]),
          listOrganizations().catch(() => [] as Organization[]),
        ]);
        const p = (prof as Profile) ?? null;
        setProfile(p);
        setMemberships(mems);
        setOrganizations(orgs);
        // organização ativa: a do perfil, ou a primeira que ele participa.
        const active = p?.active_org_id ?? mems[0]?.org_id ?? null;
        setActiveOrgIdRef(active);
      } finally {
        if (!silent) setCtxLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  // Atualiza papel/organização quando o usuário volta para a aba e periodicamente
  // (o Administrador pode ter mudado a permissão em outra sessão — reflete sem relogar).
  useEffect(() => {
    if (!userId) return;
    function onFocus() {
      if (document.visibilityState === 'visible') refreshContext(true);
    }
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => refreshContext(true), 45_000);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refreshContext, userId]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      await setActiveOrg(orgId);
      await refreshContext();
      // A organização ativa mudou: descarta o cache para recarregar os dados da nova organização.
      await queryClient.invalidateQueries();
    },
    [refreshContext, queryClient],
  );

  const activeOrgId = profile?.active_org_id ?? memberships[0]?.org_id ?? null;
  const isSuperadmin = !!profile?.is_superadmin;
  // Superadmin é flag GLOBAL do sistema e tem prioridade sobre o vínculo da organização.
  // Sem vínculo na organização ativa → sem papel (acesso mínimo). NUNCA assume 'diretor'.
  const role: AppRole | null = isSuperadmin
    ? 'superadmin'
    : memberships.find((m) => m.org_id === activeOrgId)?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        memberships,
        organizations,
        activeOrgId,
        role,
        isSuperadmin,
        ctxLoading,
        switchOrg,
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
