# AGENTS.md — guia do projeto **hello**

Contexto para qualquer pessoa (ou IA) que for mexer no projeto. Leia antes de codar.

## O que é
App de **gestão escolar** enxuto para uma professora. Foco: fazer **chamadas** (presença/falta) e lançar **notas**, com cadastros e calendário. Mobile-first, PWA, dados na nuvem.

## Stack
- **Vite + React 18 + TypeScript**
- **Tailwind CSS** (tema claro, verde esmeralda)
- **Supabase** — banco Postgres + Auth (fonte da verdade dos dados)
- **TanStack React Query** — busca/cache de dados
- **React Router v7** — rotas SPA
- **vite-plugin-pwa** — instalável/offline
- **xlsx** — import de planilhas (carregado sob demanda)
- Sem Redux/Zustand/Dexie. Sem libs de export pesadas.

## Regra de ouro do produto
**Enxuto.** Só os campos pedidos. Nada de inflar com telas/relatórios extras. A professora adiciona features aos poucos. Quando em dúvida, faça **menos** e bem feito.

## Campos (telas) atuais
| Rota | Tela | O que faz |
|------|------|-----------|
| `/` | Início | Visão geral + atalho de chamada + chamadas recentes |
| `/chamadas` | Chamadas | Turma + data → marca Presente/Falta/Atraso/Justificado → salva. Reabre a chamada do dia (não duplica) |
| `/notas` | Notas | Turma + mês (jan–dez) + ano → nota 0–10 por aluno → salva. Média anual automática. Matéria fixa: **Língua Inglesa** |
| `/escolas` | Escolas | CRUD + importar planilha |
| `/turmas` | Turmas | CRUD + importar (precisa de escola) |
| `/alunos` | Alunos | CRUD + importar (precisa de turma) |
| `/calendario` | Calendário | Embed da Google Agenda (link colado em Configurações) |
| `/configuracoes` | Configurações | Dados pessoais, trocar senha, link da agenda, sair |
| `/login` | Login | E-mail/senha (Google desativado por ora) |

## Dependência dos cadastros (IMPORTANTE)
Fluxo obrigatório: **Escola → Turma → Aluno**.
- Turmas só funciona se existir **escola** (senão mostra aviso com atalho).
- Alunos só funciona se existir **turma**.
- Chamadas/Notas precisam de **turma com alunos**.
Os botões "Importar/Novo" em Turmas e Alunos só aparecem depois do pré-requisito — isso é proposital, não bug.

## Modelo de dados (Supabase)
Tabelas: `profiles`, `schools`, `classes`, `students`, `attendance_sessions`, `attendance_records`, `grades`.
- Toda tabela de dados tem `owner_id` (default `auth.uid()`).
- **RLS**: usuário comum vê só o que é dele; **master** vê/edita tudo (`is_master()`).
- `profiles.role` = `'user'` | `'master'`. Os dois admins são master (dados compartilhados).
- Notas: `grades(student_id, subject, year, month, score)` — único por aluno/matéria/ano/mês.

Arquivos SQL em `supabase/`:
- `schema.sql` — schema completo (tem bloco de **reset que apaga tudo** no topo; só para banco vazio).
- `migration-master.sql` — adiciona role + políticas master (rodar uma vez, sem perda de dados).
- `migration-notas.sql` — cria tabela `grades` (rodar uma vez).
> **Nunca** re-rode `schema.sql` num banco com dados (o reset apaga). Use migrations.

Projeto Supabase: ref `rogvgrnkjvxdulkcunuo`.

## Auth
- Login só **e-mail/senha** hoje. Google está pronto no código (`signInWithGoogle`) mas **desativado** na UI até o OAuth ser configurado.
- "Confirm email" desligado no Supabase → cadastro entra direto.
- Trocar senha: Configurações → `supabase.auth.updateUser`.

## Deploy (Vercel)
- Conectado ao GitHub → **push na `main` redeploya automático**.
- Domínio de produção: ver aba **Domains** no Vercel (NÃO é `hello-anapaula.vercel.app`).
- `vercel.json` faz rewrite SPA (sem ele, refresh em rota dá 404).
- **Env vars no Vercel** (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Sem elas, produção não conecta no Supabase.

## Estrutura do código
```
src/
  app/App.tsx            rotas + gate de auth
  auth/AuthProvider.tsx  sessão Supabase (contexto)
  components/
    AppShell.tsx         layout (sidebar + topo mobile)
    ui.tsx               kit: Button, Input, Select, Field, Card, Modal, EmptyState, PageHeader
    ImportModal.tsx      import por planilha (genérico)
  lib/
    supabase.ts          client + helpers de auth
    queries.ts           TODAS as funções de dados (camada única)
    types.ts             tipos + constantes (SHIFTS, MONTHS, SUBJECT)
    importSheet.ts       template + parse de .xlsx/.csv
    cn.ts                merge de classes Tailwind
  pages/                 uma tela por arquivo
```

## Convenções
- Toda chamada ao banco mora em `lib/queries.ts`. Componentes não falam com `supabase` direto (exceto auth).
- Mutations invalidam as queries afetadas (`qc.invalidateQueries`).
- Datas em ISO `yyyy-MM-dd`. UI em pt-BR.
- Padronize o visual pelo `components/ui.tsx`. Não reinvente botão/input.
- Texto da interface em **português**.

## Comandos
```bash
npm install
npm run dev      # local em http://localhost:5173
npm run build    # gera dist/ (tsc roda no build)
npm run preview
```
Sempre rode `./node_modules/.bin/tsc --noEmit` e `npm run build` antes de commitar. (`npx tsc` baixa pacote errado — use o binário local.)

## Git
- Repo: `AnaPaula19872026/hello`, branch `main`.
- Commits diretos na main (repo solo). Push na main redeploya o Vercel.

## Pendências / próximos
- Reativar login Google (registrar redirect URI do Supabase no OAuth client).
- Calendário: colar link de embed da Google Agenda em Configurações.
- Possível: boletim (12 meses lado a lado), mais matérias além de Inglês.
