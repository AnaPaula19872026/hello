# hello — Gestão Escolar

App enxuto para **chamadas** (presenças/faltas), **cadastros** (escolas, turmas, alunos), **calendário** (Google Agenda) e **configurações**. React + Supabase + PWA, com login pela conta Google. Dados ficam na nuvem (Supabase), prontos para usar em várias telas.

## Rodar local
```bash
npm install
cp .env.example .env   # preencha com os dados do Supabase
npm run dev
```

## Supabase
1. Crie um projeto no Supabase.
2. **Authentication → Providers → Google**: ative e configure o OAuth (Client ID/Secret do Google Cloud).
3. **Authentication → URL Configuration**: adicione a URL do app em *Redirect URLs* (ex.: `http://localhost:5173` e a URL de produção).
4. **SQL Editor**: rode o conteúdo de `supabase/schema.sql`.
5. Configure os valores no painel de ambiente do deploy ou em `.env` com:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME=hello`

## Deploy na web (Vercel)
1. Faça push no GitHub.
2. Conecte o repositório ao Vercel.
3. Defina as variáveis de ambiente no Vercel. Não é preciso commitar `.env`.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME=hello` (opcional)
4. Use o build command padrão:
   - `npm run build`
5. Deixe o output directory como `dist`.
6. O arquivo `vercel.json` já força SPA rewrite para `index.html`.
7. Adicione a URL de produção nos Redirect URLs do Google e no Supabase.

## Estrutura (campos do app)
- **Início** — visão geral e atalho para a chamada.
- **Chamadas** — escolhe turma + data, marca Presente/Falta/Atraso/Justificado; salva no banco (edita a chamada do dia em vez de duplicar).
- **Cadastros** — Escolas, Turmas e Alunos.
- **Calendário** — embute a Google Agenda (link colado em Configurações).
- **Configurações** — dados pessoais, conta Google e link da agenda.

## PWA
Instalável e responsivo (celular, tablet, desktop). Service worker via `vite-plugin-pwa`.

## Build
```bash
npm run build && npm run preview
```
