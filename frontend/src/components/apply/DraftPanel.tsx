import { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  FileEdit,
  LayoutTemplate,
  Mail,
  Send,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { ConfirmModal } from '../ui/ConfirmModal';
import { API_BASE_URL } from '../../lib/constants';
import { useApplyStore } from '../../store/useApplyStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { handleSend } from '../../lib/actions';
import type { DraftData } from '../../store/useApplyStore';

interface MasterTemplate {
  id: string;
  name: string;
  body: string;
}

const TEMPLATES_KEY = 'APPLYBOT_TEMPLATES';

const DraftPanel = () => {
  const data = useApplyStore((s) => s.draft);
  const setDraft = useApplyStore((s) => s.setDraft);
  const selectedCV = useApplyStore((s) => s.selectedCV);
  const notify = useNotificationStore((s) => s.notify);

  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [templates, setTemplates] = useState<MasterTemplate[]>(() => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetId: string | null;
  }>({
    isOpen: false,
    targetId: null,
  });

  // const draft = useMemo<Record<string, any>>(() => data ?? {}, [data]);
  const draft = useMemo<DraftData>(() => data ?? {}, [data]);
  const canSubmit = Boolean(
    (draft.subject || '').trim() && (draft.body || '').trim(),
  );

  const updateDraft = (patch: Partial<DraftData>) => {
    if (data) {
      setDraft({ ...data, ...patch });
    } else {
      setDraft(patch);
    }
  };

  const saveTemplate = () => {
    const body = (draft.body || '').trim();
    if (!body) {
      notify?.(
        'Body email kosong, tidak bisa disimpan sebagai template.',
        'warning',
      );
      return;
    }

    const name = window.prompt(
      "Masukkan nama template (misal: 'Formal ID', 'English Tech').",
    );
    if (!name) return;

    const newTemplate: MasterTemplate = {
      id: Date.now().toString(),
      name: name.trim(),
      body,
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setSelectedTemplateId(newTemplate.id);
    notify?.('Template berhasil disimpan.', 'success');
  };

  const deleteTemplate = (id: string) => {
    setConfirmModal({ isOpen: true, targetId: id });
  };

  const executeDeleteTemplate = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    if (selectedTemplateId === id) setSelectedTemplateId('');
    setConfirmModal({ isOpen: false, targetId: null });
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (id) {
      const t = templates.find((t) => t.id === id);
      if (t) {
        updateDraft({ body: t.body });
        notify?.('Template diterapkan.', 'success');
      }
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionPrompt.trim() || isRevising) return;
    if (!(draft.body || '').trim()) {
      notify?.('Body email masih kosong.', 'warning');
      return;
    }

    const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    setIsRevising(true);

    try {
      let cvTextForRevision = draft.cv_text || '';
      if (!cvTextForRevision && selectedCV) {
        const storedCVs = localStorage.getItem('APPLYBOT_CVS');
        if (storedCVs) {
          try {
            const cvs = JSON.parse(storedCVs) as Array<{
              id: string;
              text?: string;
            }>;
            const match = cvs.find((cv) => cv.id === selectedCV);
            if (match?.text) cvTextForRevision = match.text;
          } catch {
            cvTextForRevision = '';
          }
        }
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/revise`,
        {
          current_body: draft.body || '',
          instruction: revisionPrompt,
          cv_text: cvTextForRevision,
          context_text: draft.context_text || '',
        },
        {
          headers: {
            'x-api-key': apiKey,
          },
        },
      );

      updateDraft({ body: res.data.revised_body || draft.body || '' });
      setRevisionPrompt('');
      notify?.('Body email berhasil direvisi.', 'success');
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      const msg =
        'Gagal merevisi email: ' +
        (err.response?.data?.detail || err.message || 'Unknown error');
      notify?.(msg, 'error');
    } finally {
      setIsRevising(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className='w-full md:w-1/2 p-6 flex flex-col overflow-y-visible md:overflow-y-auto relative shrink-0 md:shrink pb-24 md:pb-6'
    >
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center gap-2'>
          <FileEdit size={18} style={{ color: 'var(--text-secondary)' }} />
          <h2
            className='text-lg font-bold'
            style={{ color: 'var(--text-primary)' }}
          >
            Draf Email Lamaran
          </h2>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={saveTemplate}
            className='px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5'
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            <LayoutTemplate size={12} /> Simpan Template
          </button>
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <label
          className='text-sm font-semibold flex items-center gap-2'
          style={{ color: 'var(--text-secondary)' }}
        >
          <Mail size={14} /> Email HR Tujuan
        </label>
        <input
          type='email'
          value={draft.hr_email || ''}
          onChange={(e) => updateDraft({ hr_email: e.target.value })}
          className='w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
          style={inputStyle}
          placeholder='hr@company.com'
        />
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='flex flex-col gap-1.5'>
          <label
            className='text-xs font-semibold flex items-center gap-1.5'
            style={{ color: 'var(--text-secondary)' }}
          >
            <Building2 size={12} /> Nama Perusahaan
          </label>
          <input
            type='text'
            value={draft.company_name || ''}
            onChange={(e) => updateDraft({ company_name: e.target.value })}
            className='w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
            style={inputStyle}
            placeholder='PT. Contoh...'
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <label
            className='text-xs font-semibold flex items-center gap-1.5'
            style={{ color: 'var(--text-secondary)' }}
          >
            <Briefcase size={12} /> Posisi
          </label>
          <input
            type='text'
            value={draft.job_title || ''}
            onChange={(e) => updateDraft({ job_title: e.target.value })}
            className='w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
            style={inputStyle}
            placeholder='Software Engineer...'
          />
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <label
          className='text-sm font-semibold flex items-center gap-2'
          style={{ color: 'var(--text-secondary)' }}
        >
          <Type size={14} /> Subject Email
        </label>
        <input
          type='text'
          value={draft.subject || ''}
          onChange={(e) => updateDraft({ subject: e.target.value })}
          className='w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
          style={inputStyle}
          placeholder='Subject email...'
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <label
          className='text-sm font-semibold flex items-center gap-2'
          style={{ color: 'var(--text-secondary)' }}
        >
          <Type size={14} /> Template Email Body
        </label>
        <div className='flex items-center gap-2'>
          <select
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            className='flex-1 rounded-md px-3 py-1.5 text-sm focus:outline-none'
            style={inputStyle}
          >
            <option value=''>-- Pilih Template Tersimpan --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTemplateId && (
            <button
              type='button'
              onClick={() => deleteTemplate(selectedTemplateId)}
              className='p-2 rounded-md transition-colors text-rose-500 hover:bg-rose-500/10'
              title='Hapus Template'
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className='flex flex-col gap-1.5 flex-1 min-h-[150px]'>
        <div className='flex items-center justify-between'>
          <label
            className='text-sm font-semibold flex items-center gap-2'
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileEdit size={14} /> Body Email
          </label>
        </div>

        <textarea
          value={draft.body || ''}
          onChange={(e) => updateDraft({ body: e.target.value })}
          className='w-full h-full rounded-lg px-4 py-3 focus:outline-none focus:ring-1 transition-all resize-none font-sans text-sm leading-relaxed'
          style={inputStyle}
          placeholder='Tuliskan isi email lamaran di sini...'
        />
      </div>

      <form onSubmit={handleRevisionSubmit} className='relative mt-2'>
        <input
          type='text'
          value={revisionPrompt}
          onChange={(e) => setRevisionPrompt(e.target.value)}
          placeholder={
            isRevising
              ? 'AI sedang merevisi...'
              : "Minta AI merevisi teks (contoh: 'buat lebih formal')"
          }
          disabled={isRevising}
          className='w-full rounded-full px-4 py-2 text-sm pr-10 disabled:opacity-50 focus:outline-none focus:ring-1 transition-all'
          style={{ ...inputStyle, borderRadius: '9999px' }}
        />
        <button
          type='submit'
          disabled={isRevising}
          className='absolute right-1.5 top-1.5 p-1.5 rounded-full transition-colors'
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: isRevising ? 'var(--text-muted)' : 'var(--text-primary)',
          }}
        >
          {isRevising ? (
            <div
              className='w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin'
              style={{
                borderColor: 'var(--text-muted)',
                borderTopColor: 'transparent',
              }}
            />
          ) : (
            <Sparkles size={14} />
          )}
        </button>
      </form>

      <div
        className='mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2'
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          type='button'
          onClick={() => handleSend('gmail')}
          disabled={!canSubmit}
          className='font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50'
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          <Send size={14} /> Gmail
        </button>

        <button
          type='button'
          onClick={() => handleSend('outlook')}
          disabled={!canSubmit}
          className='font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50'
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          <Send size={14} /> Outlook
        </button>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title='Hapus Template'
        message='Yakin ingin menghapus template ini? Data tidak dapat dikembalikan.'
        onConfirm={() => {
          if (confirmModal.targetId)
            executeDeleteTemplate(confirmModal.targetId);
        }}
        onCancel={() => setConfirmModal({ isOpen: false, targetId: null })}
      />
    </motion.div>
  );
};

export default DraftPanel;
