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
  | 'permissoes'
  | 'organizacoes';

const ALL_ROLES: AppRole[] = ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'];

/** Módulos configuráveis no Centro de Permissões (exclui os exclusivos do superadmin). */
export const CONFIGURABLE_MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'chamadas', label: 'Chamadas' },
  { key: 'notas', label: 'Notas' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'avisos', label: 'Avisos' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'escolas', label: 'Escolas' },
  { key: 'turmas', label: 'Turmas' },
  { key: 'alunos', label: 'Alunos' },
];

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
  permissoes: [], // só superadmin
  organizacoes: [], // só superadmin
};

// Na HQ, o superadmin gerencia clientes/permissões. Dados escolares ficam nas
// bases dos clientes, não na organização de administração.
export const HQ_MODULES = new Set<ModuleKey>(['dashboard', 'organizacoes', 'permissoes', 'configuracoes']);

// Overrides definidos no Centro de Permissões (carregados do banco pelo AuthProvider).
// Chave: `${role}|${module}` -> allowed.
let overrides: Record<string, boolean> = {};
export function setPermissionOverrides(map: Record<string, boolean>) {
  overrides = map;
}
export function permKey(role: AppRole, module: ModuleKey) {
  return `${role}|${module}`;
}

/** Padrão do código (usado quando não há override no banco). */
export function defaultAllowed(role: AppRole, module: ModuleKey): boolean {
  return ACCESS[module].includes(role);
}

/** O papel pode acessar o módulo? superadmin sempre pode; overrides do banco vencem o padrão. */
export function can(role: AppRole | null, module: ModuleKey): boolean {
  if (role === 'superadmin') return true;
  if (!role) return false;
  const ov = overrides[permKey(role, module)];
  if (ov !== undefined) return ov;
  return defaultAllowed(role, module);
}

/** Acesso final usado por rotas e menu, incluindo a regra da HQ. */
export function canAccessModule(role: AppRole | null, module: ModuleKey, isHq: boolean): boolean {
  return can(role, module) && (!isHq || HQ_MODULES.has(module));
}

/** Quem pode gerenciar membros/organização (convidar, etc.). */
export function canManageOrg(role: AppRole | null): boolean {
  return role === 'superadmin' || role === 'diretor' || role === 'coordenador';
}

/** Quem pode disparar avisos (deve casar com a RLS de notices). */
export function canSendNotice(role: AppRole | null): boolean {
  return role === 'superadmin' || role === 'diretor' || role === 'coordenador' || role === 'marketing';
}

/** Quem pode criar/editar eventos do calendário (deve casar com a RLS). */
export function canManageCalendar(role: AppRole | null): boolean {
  return role === 'superadmin' || role === 'diretor' || role === 'coordenador';
}
