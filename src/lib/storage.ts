import { supabase } from './supabase';

/** Traduz erros do Storage do Supabase para mensagens claras (sem jargão técnico no cliente). */
export function translateStorageError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('mime') || m.includes('content type') || m.includes('not supported') || m.includes('not allowed')) {
    return 'Este tipo de arquivo está bloqueado no servidor de armazenamento. Rode a migration-storage-fix.sql no Supabase para liberar todos os formatos.';
  }
  if (m.includes('exceeded') || m.includes('too large') || m.includes('maximum') || m.includes('payload') || m.includes('413')) {
    return 'Arquivo acima do limite. Envie arquivos de até 50 MB.';
  }
  if (m.includes('row-level security') || m.includes('policy') || m.includes('unauthorized') || m.includes('403')) {
    return 'Sem permissão para enviar arquivos neste espaço. Verifique seu acesso à organização.';
  }
  if (m.includes('bucket not found') || m.includes('404')) {
    return 'Armazenamento não configurado. Rode as migrations de storage no Supabase.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Falha de conexão ao enviar o arquivo. Verifique a internet e tente novamente.';
  }
  return message || 'Não foi possível enviar o arquivo. Tente novamente.';
}

/** Nome de arquivo seguro para caminho de Storage (sem acentos/espaços/caracteres especiais). */
export function safeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120); // evita caminhos absurdamente longos
}

/**
 * Upload robusto para qualquer bucket privado.
 * - contentType explícito (arquivos sem MIME, ex.: .pages/.heic, sobem como octet-stream).
 * - upsert evita erro de nome duplicado.
 * - erro sempre traduzido para PT claro.
 */
export async function uploadToBucket(bucket: string, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw new Error(translateStorageError(error.message));
}

/** Dispara o download de um único arquivo a partir de um Blob. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Baixa vários anexos de uma vez. Com 2+ arquivos, empacota tudo num único .zip
 * (lazy import do jszip — não pesa o bundle inicial). Com 1 arquivo, baixa direto.
 */
export async function downloadAllAttachments(
  files: { name: string; url?: string }[],
  zipName = 'anexos',
): Promise<void> {
  const valid = files.filter((f) => f.url);
  if (!valid.length) throw new Error('Nenhum arquivo disponível para baixar.');

  if (valid.length === 1) {
    const f = valid[0];
    const res = await fetch(f.url as string);
    if (!res.ok) throw new Error('Não foi possível baixar o arquivo.');
    triggerDownload(await res.blob(), f.name);
    return;
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  await Promise.all(
    valid.map(async (f) => {
      const res = await fetch(f.url as string);
      if (!res.ok) return;
      // evita nomes repetidos dentro do zip
      let name = f.name || 'arquivo';
      let i = 1;
      while (used.has(name)) {
        const dot = f.name.lastIndexOf('.');
        name = dot > 0 ? `${f.name.slice(0, dot)} (${i})${f.name.slice(dot)}` : `${f.name} (${i})`;
        i++;
      }
      used.add(name);
      zip.file(name, await res.blob());
    }),
  );
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${zipName}.zip`);
}
