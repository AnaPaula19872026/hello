# hello - Chamada Rápida Escolar

Projeto React mobile first para registrar presença escolar em poucos toques. Todos os alunos iniciam como presentes, o professor toca apenas ausentes ou atrasados, salva localmente e sincroniza com Supabase.

## Stack
React, Vite, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, React Router, TanStack Query, Zustand, React Hook Form, Zod, Dexie, date-fns, Lucide, xlsx, papaparse, jsPDF, docx, file-saver, mammoth, react-dropzone.

## Fluxo
Login Google ou e-mail -> escola -> turma -> aula -> chamada rápida -> salvar offline -> sincronizar.

## Offline
Dexie guarda students, sessions e syncQueue. O salvamento da chamada é local primeiro; a fila envia para Supabase quando a internet voltar.

## Permissões
RLS por escola. Professor vê suas turmas/chamadas; coordenador e secretaria gerenciam cadastros; administrador gerencia usuários; auditor consulta.
