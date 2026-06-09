import { Download, FileSpreadsheet, FileText, Plus, Trash2, Upload, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createStudentTemplate } from '../features/imports/studentTemplate';
import { exportDemoReport } from '../features/reports/reportExport';

const pageCopy: Record<string, { title: string; description: string; action: string }> = {
  history: {
    title: 'Histórico de chamadas',
    description: 'Consulte chamadas por escola, turma, data, professor e status de sincronização.',
    action: 'Filtrar historico',
  },
  students: {
    title: 'Cadastro de alunos',
    description: 'Gerencie dados dos alunos, matrículas, turmas, responsáveis e situação escolar.',
    action: 'Novo aluno',
  },
  schoolRegistry: {
    title: 'Cadastro de escolas',
    description: 'Crie e organize escolas, unidades, turnos, usuários responsáveis e permissões.',
    action: 'Nova escola',
  },
  classRegistry: {
    title: 'Cadastro de turmas',
    description: 'Monte turmas por escola, serie, turno, professor e quantidade de alunos.',
    action: 'Nova turma',
  },
  calendars: {
    title: 'Calendários',
    description: 'Organize períodos letivos, feriados, eventos, semanas avaliativas e dias sem aula.',
    action: 'Novo calendario',
  },
  weeklyPlanning: {
    title: 'Planejamento semanal',
    description: 'Planeje aulas, chamadas, conteúdos, observações e acompanhamento da semana.',
    action: 'Novo planejamento',
  },
  studentStats: {
    title: 'Estatísticas por aluno',
    description: 'Acompanhe presença individual, faltas justificadas, atrasos e histórico de chamadas.',
    action: 'Selecionar aluno',
  },
  classStats: {
    title: 'Estatísticas por turma',
    description: 'Compare frequência, ausências e tendências por turma, turno ou disciplina.',
    action: 'Selecionar turma',
  },
  alerts: {
    title: 'Alunos com excesso de faltas',
    description: 'Priorize alunos em risco, gere comunicados e acompanhe as medidas tomadas.',
    action: 'Revisar alertas',
  },
  settings: {
    title: 'Configurações',
    description: 'Ajuste limites de faltas, perfis, integrações, sincronização e dados da escola.',
    action: 'Editar configurações',
  },
};

export function PlaceholderPage({ type }: { type: string }) {
  const copy = pageCopy[type] ?? pageCopy.history;
  const storageKey = `hello-module-${type}`;
  const [items, setItems] = useState<{ id: string; title: string; note: string; createdAt: string }[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    setItems(saved ? JSON.parse(saved) : []);
  }, [storageKey]);

  function persist(next: { id: string; title: string; note: string; createdAt: string }[]) {
    setItems(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function addItem() {
    const title = window.prompt(copy.action);
    if (!title) return;
    const note = window.prompt('Observação') ?? '';
    persist([{ id: crypto.randomUUID(), title, note, createdAt: new Date().toISOString() }, ...items]);
  }

  function deleteItem(id: string) {
    const confirmed = window.confirm('Excluir este registro?');
    if (!confirmed) return;
    persist(items.filter((item) => item.id !== id));
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-600">Módulo</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{copy.title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 sm:text-base">{copy.description}</p>
        </div>
        <button onClick={addItem} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-soft">
          <Plus size={18} />
          {copy.action}
        </button>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <Users className="text-emerald-600" />
          <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-white">Registros do módulo</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Use o botão principal para criar registros. Tudo fica salvo neste navegador e pode ser excluído quando necessário.
          </p>
        </div>
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              Nenhum registro criado.
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <strong className="text-sm text-slate-950 dark:text-white">{item.title}</strong>
                  {item.note ? <p className="mt-1 text-sm text-slate-500">{item.note}</p> : null}
                  <p className="mt-2 text-xs font-semibold text-slate-400">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <button onClick={() => deleteItem(item.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700" aria-label="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export function ImportsPage() {
  const formats = ['Excel .xlsx', 'CSV', 'TXT', 'DOC', 'DOCX', 'PDF'];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
      <h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Importação em massa</h2>
      <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 sm:text-base">
        Importe bases escolares e gere modelos padronizados para manter os cadastros consistentes.
      </p>
      <section className="mt-6 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <button
          onClick={createStudentTemplate}
          className="flex min-h-32 items-center gap-4 rounded-lg bg-emerald-600 p-5 text-left font-black text-white shadow-soft"
        >
          <FileSpreadsheet size={28} />
          <span>Baixar planilha modelo</span>
        </button>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <Upload className="mx-auto mb-3 text-slate-400" />
          <strong className="text-slate-950 dark:text-white">Arraste o arquivo aqui</strong>
          <p className="mt-1 text-sm text-slate-500">Área preparada para react-dropzone e validação de colunas.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {formats.map((format) => (
              <span key={format} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {format}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function ReportsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
      <h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Relatórios</h2>
      <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 sm:text-base">
        Exportação em PDF, Excel, Word, CSV e TXT com cabeçalho, filtros, totalizadores e percentuais.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {['Por turma', 'Por aluno', 'Por escola', 'Por professor', 'Excesso de faltas', 'Atrasos'].map((report) => (
          <div key={report} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <FileText className="text-emerald-600" />
            <strong className="mt-3 block text-slate-950 dark:text-white">Relatório {report}</strong>
            <button
              onClick={() => exportDemoReport(report)}
              className="mt-4 flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Download size={16} />
              Exportar demo
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
