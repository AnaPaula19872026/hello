// Importação por planilha — template + leitura de .xlsx/.csv.
// xlsx é carregado sob demanda (dynamic import) para não pesar no bundle inicial.

export interface ColumnDef {
  key: string;
  label: string;
  example: string;
  required?: boolean;
}

/** Planilha única e inteligente: cada linha cria escola + turma + aluno conforme preenchido. */
export const CADASTRO_COLUMNS: ColumnDef[] = [
  { key: 'school', label: 'Escola', example: 'E.M. João da Silva', required: true },
  { key: 'city', label: 'Cidade', example: 'Goiânia' },
  { key: 'class', label: 'Turma', example: '5º ano A' },
  { key: 'shift', label: 'Turno', example: 'Manhã' },
  { key: 'year', label: 'Ano', example: '2026' },
  { key: 'student', label: 'Aluno', example: 'Maria de Souza' },
  { key: 'registration', label: 'Matrícula', example: '2026001' },
  { key: 'guardian', label: 'Responsável', example: 'João de Souza' },
  { key: 'phone', label: 'Telefone', example: '(62) 90000-0000' },
];

/** Gera e baixa a planilha modelo: aba "Modelo" (só cabeçalho) + aba "Exemplo". */
export async function downloadTemplate(fileName: string, columns: ColumnDef[]) {
  const XLSX = await import('xlsx');
  const headers = columns.map((c) => c.label);
  const modelo = XLSX.utils.aoa_to_sheet([headers]);
  const exemplo = XLSX.utils.aoa_to_sheet([headers, columns.map((c) => c.example)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, modelo, 'Modelo');
  XLSX.utils.book_append_sheet(wb, exemplo, 'Exemplo');
  XLSX.writeFile(wb, fileName);
}

/** Exporta uma matriz (primeira linha = cabeçalho) para .xlsx. */
export async function downloadXlsx(fileName: string, aoa: (string | number | null)[][], sheetName = 'Relatório') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export interface ParseResult {
  rows: Record<string, string>[];
  errors: string[];
}

/** Lê a primeira aba do arquivo e mapeia colunas pelos rótulos definidos. */
export async function parseSheet(file: File, columns: ColumnDef[]): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const labelToKey: Record<string, string> = {};
  columns.forEach((c) => (labelToKey[norm(c.label)] = c.key));

  const rows: Record<string, string>[] = [];
  const errors: string[] = [];

  raw.forEach((r, i) => {
    const obj: Record<string, string> = {};
    Object.entries(r).forEach(([label, val]) => {
      const key = labelToKey[norm(label)];
      if (key) obj[key] = String(val ?? '').trim();
    });
    // ignora linhas vazias
    if (!Object.values(obj).some((v) => v)) return;
    const missing = columns.filter((c) => c.required && !obj[c.key]).map((c) => c.label);
    if (missing.length) errors.push(`Linha ${i + 2}: faltando ${missing.join(', ')}`);
    else rows.push(obj);
  });

  return { rows, errors };
}

function norm(s: string) {
  return String(s).toLowerCase().trim();
}
