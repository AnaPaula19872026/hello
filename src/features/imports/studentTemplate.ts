import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

type TemplateKind = 'schools' | 'classes' | 'students' | 'subjects' | 'complete';

const templates = {
  schools: {
    fileName: 'modelo-cadastro-escolas-hello.xlsx',
    title: 'PLANILHA PADRÃO - CADASTRO DE ESCOLAS',
    required: 'Campos obrigatórios: Nome da escola.',
    sheets: [
      {
        name: 'Escolas',
        headers: ['Nome da escola', 'Cidade ou bairro', 'Código INEP', 'Telefone', 'E-mail', 'Responsável', 'Ativa', 'Observações'],
        sample: ['Escola Municipal Modelo', 'Centro', '00000000', '(00) 3000-0000', 'escola@email.com', 'Ana Paula', 'Sim', ''],
        rows: 40,
      },
    ],
  },
  classes: {
    fileName: 'modelo-cadastro-turmas-hello.xlsx',
    title: 'PLANILHA PADRÃO - CADASTRO DE TURMAS',
    required: 'Campos obrigatórios: Escola, Nome da turma e Turno.',
    sheets: [
      {
        name: 'Turmas',
        headers: ['Escola', 'Nome da turma', 'Série/Ano', 'Turno', 'Professor responsável', 'Sala', 'Ativa', 'Observações'],
        sample: ['Escola Municipal Modelo', '5º Ano A', '5º Ano', 'Matutino', 'Maria Silva', 'Sala 04', 'Sim', ''],
        rows: 40,
      },
    ],
  },
  students: {
    fileName: 'modelo-cadastro-alunos-hello.xlsx',
    title: 'PLANILHA PADRÃO - CADASTRO DE ALUNOS',
    required: 'Campos obrigatórios: Nome completo do aluno, Matrícula, Escola, Turma, Turno e Situação.',
    sheets: [
      {
        name: 'Alunos',
        headers: [
          'Nome completo do aluno',
          'Matrícula',
          'CPF ou documento',
          'Data de nascimento',
          'Escola',
          'Turma',
          'Turno',
          'Nome do responsável',
          'Telefone do responsável',
          'E-mail do responsável',
          'Situação do aluno',
          'Observações',
        ],
        sample: [
          'Maria Eduarda Santos',
          '2026001',
          '000.000.000-00',
          '2014-04-10',
          'Escola Municipal Modelo',
          '5º Ano A',
          'Matutino',
          'Joana Santos',
          '(00) 90000-0000',
          'responsavel@email.com',
          'Ativo',
          'Sem observações',
        ],
        rows: 80,
      },
    ],
  },
  subjects: {
    fileName: 'modelo-cadastro-disciplinas-hello.xlsx',
    title: 'PLANILHA PADRÃO - CADASTRO DE DISCIPLINAS',
    required: 'Campos obrigatórios: Escola e Disciplina.',
    sheets: [
      {
        name: 'Disciplinas',
        headers: ['Escola', 'Disciplina', 'Professor', 'Carga horária semanal', 'Ativa', 'Observações'],
        sample: ['Escola Municipal Modelo', 'Matemática', 'Maria Silva', '5', 'Sim', ''],
        rows: 40,
      },
    ],
  },
} as const;

const validations = [
  ['Valores aceitos'],
  ['Turnos', 'Matutino, Vespertino, Noturno, Integral'],
  ['Situação do aluno', 'Ativo, Inativo, Transferido'],
  ['Ativa', 'Sim, Não'],
  ['Datas', 'Use o formato AAAA-MM-DD, exemplo: 2014-04-10'],
];

export function createStudentTemplate() {
  createRegistryTemplate('students');
}

export function createRegistryTemplate(kind: TemplateKind) {
  if (kind === 'complete') {
    createCompleteTemplate();
    return;
  }

  const template = templates[kind];
  const wb = XLSX.utils.book_new();
  appendInstructionSheets(wb, template.title, template.required);
  template.sheets.forEach((sheet) => appendDataSheet(wb, sheet.name, sheet.headers, sheet.sample, sheet.rows));
  appendValidationSheet(wb);
  saveWorkbook(wb, template.fileName);
}

export function createCompleteTemplate() {
  const wb = XLSX.utils.book_new();
  appendInstructionSheets(
    wb,
    'PLANILHA PADRÃO COMPLETA - HELLO',
    'Preencha as abas na ordem: Escolas, Turmas, Disciplinas e Alunos. Use exatamente os mesmos nomes de escola e turma nas abas relacionadas.',
  );
  Object.values(templates).forEach((template) => {
    template.sheets.forEach((sheet) => appendDataSheet(wb, sheet.name, sheet.headers, sheet.sample, sheet.rows));
  });
  appendValidationSheet(wb);
  saveWorkbook(wb, 'modelo-completo-cadastros-hello.xlsx');
}

function appendInstructionSheets(wb: XLSX.WorkBook, title: string, required: string) {
  const rows = [
    [title],
    [required],
    ['Não altere os nomes das abas nem os cabeçalhos.'],
    ['Apague a linha de exemplo antes de importar dados reais, se desejar.'],
    ['Use uma linha por registro.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 88 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Instruções');
}

function appendValidationSheet(wb: XLSX.WorkBook) {
  const ws = XLSX.utils.aoa_to_sheet(validations);
  ws['!cols'] = [{ wch: 24 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Validações');
}

function appendDataSheet(wb: XLSX.WorkBook, name: string, headers: readonly string[], sample: readonly string[], rowCount: number) {
  const rows = [
    [...headers],
    [...sample],
    ...Array.from({ length: rowCount }).map(() => Array(headers.length).fill('')),
    [],
    ['Total preenchido', `=COUNTA(A2:A${rowCount + 2})`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map((header) => ({ wch: Math.max(18, header.length + 2) }));
  ws['!autofilter'] = { ref: `A1:${columnName(headers.length)}${rowCount + 2}` };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function columnName(count: number) {
  let dividend = count;
  let column = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    column = String.fromCharCode(65 + modulo) + column;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return column;
}

function saveWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([out], { type: 'application/octet-stream' }), fileName);
}
