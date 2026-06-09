# hello

Sistema **Chamada Rápida Escolar**: React + Supabase para controle de presença escolar com foco em velocidade, mobile first, login Google, modo offline, relatórios e importação em massa.

## Rodar local
```bash
npm install
cp .env.example .env
npm run dev
```

## Supabase
1. Crie um projeto no Supabase.
2. Ative Authentication > Providers > Google.
3. Configure as URLs de redirect do app.
4. Rode o SQL em `supabase/schema.sql`.
5. Preencha `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## GitHub
```bash
git remote add origin https://github.com/SEU_USUARIO/hello.git
git branch -M main
git push -u origin main
```

## O que já vem pronto
- Login moderno com Google e e-mail/senha.
- Dashboard responsivo.
- Seleção de escola, turma e aula.
- Tela de chamada rápida otimizada para celular.
- Status presente, ausente, atrasado e justificado.
- Busca rápida, filtros e botão fixo de salvar.
- Persistência offline com Dexie e fila de sincronização.
- Importação com modelo Excel gerado pelo sistema.
- Exportação demo para PDF, Excel, DOCX, CSV e TXT.
- SQL completo com tabelas, índices, RLS e trigger de criação de perfil.
