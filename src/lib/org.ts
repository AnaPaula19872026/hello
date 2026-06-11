/**
 * Guarda em memória a organização ativa do usuário, para as funções de query
 * que precisam carimbar org_id em uniques (ex.: composição de notas).
 * Setado pelo AuthProvider quando o contexto carrega/muda.
 */
let activeOrgId: string | null = null;

export function setActiveOrgIdRef(id: string | null) {
  activeOrgId = id;
}
export function getActiveOrgId(): string | null {
  return activeOrgId;
}
