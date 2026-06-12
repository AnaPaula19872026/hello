import { Download, Eye, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './ui';

/** Anexo genérico (avisos, calendário…). `url` é a URL assinada para baixar/abrir. */
export interface Attachment {
  id: string;
  name: string;
  path?: string;
  mime: string | null;
  url?: string;
}

function canPreview(mime: string | null | undefined) {
  return !!mime && (mime.startsWith('image/') || mime === 'application/pdf');
}

export function PreviewModal({ name, url, mime, onClose }: { name: string; url: string; mime: string | null; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={name} size="xl">
      <div className="space-y-3">
        {mime?.startsWith('image/') ? (
          <img src={url} alt={name} className="mx-auto max-h-[70vh] rounded-xl object-contain" />
        ) : mime === 'application/pdf' ? (
          <iframe src={url} title={name} className="h-[70vh] w-full rounded-xl border border-slate-200" />
        ) : (
          <p className="text-sm text-slate-500">Pré-visualização não disponível para este tipo de arquivo.</p>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <Download size={16} /> Baixar
        </a>
      </div>
    </Modal>
  );
}

export function AttachmentChips({ attachments }: { attachments: Attachment[] }) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  if (!attachments.length) return null;
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700"
          >
            <Paperclip size={14} className="shrink-0 text-slate-400" />
            <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.name} className="truncate hover:text-emerald-700">
              {a.name}
            </a>
            {canPreview(a.mime) && a.url ? (
              <button onClick={() => setPreview(a)} aria-label="Pré-visualizar" className="shrink-0 text-slate-400 hover:text-emerald-700">
                <Eye size={15} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {preview?.url ? <PreviewModal name={preview.name} url={preview.url} mime={preview.mime} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
