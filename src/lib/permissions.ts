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
  | 'organizacoes';

const ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'],
  chamadas: ['diretor', 'coordenador', 'professor'],
  notas: ['diretor', 'coordenador', 'professor'],
  relatorios: ['diretor', 'coordenador', 'secretaria'],
  calendario: ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'],
  escolas: ['diretor', 'coordenador', 'secretaria'],
  turmas: ['diretor', 'coordenador', 'secretaria'],
  alunos: ['diretor', 'coordenador', 'secretaria'],
  configuracoes: ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'],
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
