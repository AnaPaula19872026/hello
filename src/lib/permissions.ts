import type { AppRole } from './types';

/**
 * Controle de acesso por papel (RBAC). Define quais papéis enxergam cada módulo.
 * superadmin enxerga tudo (curto-circuito em `can`).
 */
export type ModuleKey =
  | 'dashboard'
  | 'chamadas'
  | 'notas'
  | 'relatorios'
  | 'calendario'
  | 'escolas'
  | 'turmas'
  | 'alunos'
  | 'configuracoes'
  | 'avisos'
  | 'organizacoes';

const ALL_ROLES: AppRole[] = ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'];

const ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ALL_ROLES,
  chamadas: ['diretor', 'coordenador', 'professor'],
  notas: ['diretor', 'coordenador', 'professor'],
  relatorios: ['diretor', 'coordenador', 'secretaria'],
  calendario: ALL_ROLES,
  escolas: ['diretor', 'coordenador', 'secretaria'],
  turmas: ['diretor', 'coordenador', 'secretaria'],
  alunos: ['diretor', 'coordenador', 'secretaria'],
  configuracoes: ALL_ROLES,
  avisos: ALL_ROLES, // todos recebem avisos
  organizacoes: [], // só superadmin
};

/** O papel pode acessar o módulo? superadmin sempre pode. */
export function can(role: AppRole | null, module: ModuleKey): boolean {
  if (role === 'superadmin') return true;
  if (!role) return false;
  return ACCESS[module].includes(role);
}

/** Quem pode gerenciar membros/organização (convidar, etc.). */
export function canManageOrg(role: AppRole | null): boolean {
  return role === 'superadmin' || role === 'diretor' || role === 'coordenador';
}

/** Quem pode disparar avisos (deve casar com a RLS de notices). */
export function canSendNotice(role: AppRole | null): boolean {
  return role === 'superadmin' || role === 'diretor' || role === 'coordenador' || role === 'marketing';
}
