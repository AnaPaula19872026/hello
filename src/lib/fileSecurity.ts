const MB = 1024 * 1024;

export const MAX_SHEET_FILE_SIZE = 5 * MB;
export const MAX_UPLOAD_FILE_SIZE = 20 * MB;
export const MAX_IMPORT_ROWS = 5000;

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function assertSpreadsheetFile(file: File): void {
  const ext = fileExtension(file.name);
  if (!['xlsx', 'xls', 'csv'].includes(ext)) throw new Error('Formato inválido. Use .xlsx, .xls ou .csv.');
  if (file.size > MAX_SHEET_FILE_SIZE) throw new Error('Arquivo muito grande. Use planilhas de até 5 MB.');
}

export function assertCalendarImportFile(file: File): void {
  const ext = fileExtension(file.name);
  if (!['xlsx', 'xls', 'csv', 'ics'].includes(ext)) throw new Error('Formato inválido. Use .xlsx, .xls, .csv ou .ics.');
  if (file.size > MAX_SHEET_FILE_SIZE) throw new Error('Arquivo muito grande. Use arquivos de até 5 MB.');
}

export function assertUploadFile(file: File): void {
  const ext = fileExtension(file.name);
  const allowed = new Set([
    'csv',
    'doc',
    'docx',
    'gif',
    'heic',
    'heif',
    'jpg',
    'jpeg',
    'key',
    'numbers',
    'odt',
    'pages',
    'pdf',
    'png',
    'ppt',
    'pptx',
    'rtf',
    'txt',
    'webp',
    'xls',
    'xlsx',
  ]);
  if (!allowed.has(ext)) throw new Error('Tipo de arquivo não permitido.');
  if (file.size > MAX_UPLOAD_FILE_SIZE) throw new Error('Arquivo muito grande. Envie arquivos de até 20 MB.');
}

export function assertImportRowLimit(total: number): void {
  if (total > MAX_IMPORT_ROWS) throw new Error(`Planilha muito grande. Importe no máximo ${MAX_IMPORT_ROWS} linhas por vez.`);
}
