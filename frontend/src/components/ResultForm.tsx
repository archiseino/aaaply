import React, { useState } from 'react';
import { Mail, Type, Send, FileEdit, Building2, Briefcase, Sparkles, LayoutTemplate, X, Paperclip, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { rotateApiKey } from '../utils/apiManager';
import { ConfirmModal } from './ConfirmModal';

interface ResultFormProps {
  data: {
    hr_email?: string;
    subject?: string;
    body?: string;
    company_name?: string;
    job_title?: string;
    context_text?: string;
    cv_text?: string;
  };
  cvHistory: { id: string; name: string }[];
  selectedCV: string;
  onCVChange: (id: string) => void;
  onChange: (data: any) => void;
  onSend: (method: 'outlook' | 'gmail' | 'native') => void | Promise<void>;
  onCopyFileCV?: () => Promise<boolean>;
  notify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface MasterTemplate {
  id: string;
  name: string;
  body: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const ResultForm: React.FC<ResultFormProps> = ({ data, cvHistory, selectedCV, onCVChange, onChange, onSend, onCopyFileCV, notify }) => {
  const [templateMode, setTemplateMode] = useState<'ai' | 'custom'>('ai');
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [templates, setTemplates] = useState<MasterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, targetId: string | null}>({ isOpen: false, targetId: null });

  React.useEffect(() => {
    const stored = localStorage.getItem('APPLYBOT_TEMPLATES');
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch(e) {}
    }
  }, []);

  const saveTemplate = () => {
    const name = window.prompt("Masukkan nama untuk master template ini (misal: 'Template IT', 'Template Kasual'):");
    if (!name) return;
    const newTemplate: MasterTemplate = {
      id: Date.now().toString(),
      name,
      body: data.body || ''
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('APPLYBOT_TEMPLATES', JSON.stringify(updated));
    setSelectedTemplateId(newTemplate.id);
    if (notify) notify("Template berhasil disimpan!", "success");
    else alert("Template berhasil disimpan!");
  };

  const deleteTemplate = (id: string) => {
    setConfirmModal({ isOpen: true, targetId: id });
  };

  const executeDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('APPLYBOT_TEMPLATES', JSON.stringify(updated));
    if (selectedTemplateId === id) setSelectedTemplateId('');
    setConfirmModal({ isOpen: false, targetId: null });
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (id) {
      const t = templates.find(t => t.id === id);
      if (t) {
        onChange({ ...data, body: t.body });
      }
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionPrompt.trim() || isRevising) return;
    
    // API Key check removed
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    setIsRevising(true);
    try {
      // Robust CV text retrieval: use data.cv_text, or fall back to cvHistory lookup
      let cvTextForRevision = data.cv_text || "";
      if (!cvTextForRevision && selectedCV) {
        const storedCVs = localStorage.getItem('APPLYBOT_CVS');
        if (storedCVs) {
          try {
            const cvs = JSON.parse(storedCVs);
            const match = cvs.find((cv: any) => cv.id === selectedCV);
            if (match?.text) cvTextForRevision = match.text;
          } catch (e) {}
        }
      }

      const res = await axios.post(`${API_BASE_URL}/api/revise`, {
        current_body: data.body || "",
        instruction: revisionPrompt,
        cv_text: cvTextForRevision,
        context_text: data.context_text || ""
      }, {
        headers: {
          'x-api-key': apiKey
        }
      });
      
      onChange({
        ...data, 
        body: res.data.revised_body
      });
      setRevisionPrompt('');
    } catch (error: any) {
      console.error(error);

      // AUTO-ROTATION LOGIC
      if (error.response?.status === 429 || (error.response?.data?.detail && error.response.data.detail.toLowerCase().includes('quota'))) {
        const currentKey = localStorage.getItem('GEMINI_API_KEY') || '';
        const rotated = rotateApiKey(currentKey);
        if (rotated) {
          if (notify) notify(`Kuota habis. Otomatis beralih ke ${rotated.nextName}...`, "info");
          setTimeout(() => handleRevisionSubmit(e), 1000);
          return;
        }
      }

      const msg = "Gagal merevisi email: " + (error.response?.data?.detail || error.message);
      if (notify) notify(msg, "error");
      else alert(msg);
    } finally {
      setIsRevising(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const [cvCopied, setCvCopied] = useState(false);
  const [bodyCopied, setBodyCopied] = useState(false);
  const [cvExists, setCvExists] = useState<boolean | null>(null);

  // Check if CV blob exists when selectedCV changes
  React.useEffect(() => {
    const checkCV = async () => {
      if (!selectedCV) {
        setCvExists(null);
        return;
      }
      try {
        const { get } = await import('idb-keyval');
        const blob = await get(`cv_blob_${selectedCV}`);
        setCvExists(blob instanceof Blob);
      } catch (e) {
        setCvExists(false);
      }
    };
    checkCV();
  }, [selectedCV]);

  const handleCopyCV = async () => {
    if (onCopyFileCV) {
      try {
        const success = await onCopyFileCV();
        if (success) {
          setCvCopied(true);
          setTimeout(() => setCvCopied(false), 3000);
          if (notify) notify("CV berhasil disalin!", "success");
        } else {
          if (cvExists === false) {
            if (notify) notify("File CV tidak ditemukan di memori browser. Silakan upload ulang CV Anda di Pengaturan.", "error");
          } else {
            if (notify) notify("Gagal menyalin CV. Fitur ini mungkin terbatas di browser Anda.", "warning");
          }
        }
      } catch (err) {
        console.error("handleCopyCV error:", err);
        if (notify) notify("Terjadi kesalahan saat menyalin CV.", "error");
      }
    } else {
      if (notify) notify("Fitur salin CV tidak tersedia.", "error");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-full gap-4 relative"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileEdit size={20} style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Draf Email Lamaran</h2>
        </div>
        
        {/* Template Selector */}
        <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setTemplateMode('ai')}
            className="px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all"
            style={templateMode === 'ai' ? { backgroundColor: 'var(--text-primary)', color: 'var(--text-inverse)' } : { color: 'var(--text-muted)' }}
          >
            <Sparkles size={12} /> AI Tailored
          </button>
          <button 
            onClick={() => setTemplateMode('custom')}
            className="px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all"
            style={templateMode === 'custom' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}
          >
            <LayoutTemplate size={12} /> Custom
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Mail size={14} /> Email HR Tujuan
        </label>
        <input 
          type="email" 
          value={data.hr_email || ''}
          onChange={(e) => onChange({...data, hr_email: e.target.value})}
          className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
          style={inputStyle}
          placeholder="hr@company.com"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Building2 size={12} /> Nama Perusahaan
          </label>
          <input 
            type="text" 
            value={data.company_name || ''}
            onChange={(e) => onChange({...data, company_name: e.target.value})}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
            style={inputStyle}
            placeholder="PT. Contoh..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Briefcase size={12} /> Posisi
          </label>
          <input 
            type="text" 
            value={data.job_title || ''}
            onChange={(e) => onChange({...data, job_title: e.target.value})}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
            style={inputStyle}
            placeholder="Software Engineer..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Type size={14} /> Subject Email
        </label>
        <input 
          type="text" 
          value={data.subject || ''}
          onChange={(e) => onChange({...data, subject: e.target.value})}
          className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all"
          style={inputStyle}
          placeholder="Subject email..."
        />
      </div>

      {templateMode === 'custom' && (
        <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Pilih Master Template</label>
            <button 
              onClick={saveTemplate}
              className="text-xs font-semibold transition-colors px-2 py-1 rounded"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}
            >
              + Simpan sebagai Template
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={selectedTemplateId}
              onChange={handleTemplateChange}
              className="flex-1 rounded-md px-3 py-1.5 text-sm focus:outline-none"
              style={inputStyle}
            >
              <option value="">-- Pilih Template Tersimpan --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTemplateId && (
              <button 
                onClick={() => deleteTemplate(selectedTemplateId)}
                className="p-1.5 rounded-md transition-colors text-rose-500 hover:bg-rose-500/10"
                title="Hapus Template"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 flex-1 min-h-[150px]">
        <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <FileEdit size={14} /> Body Email
        </label>
        <textarea 
          value={data.body || ''}
          onChange={(e) => onChange({...data, body: e.target.value})}
          className="w-full h-full rounded-lg px-4 py-3 focus:outline-none focus:ring-1 transition-all resize-none font-sans text-sm leading-relaxed"
          style={inputStyle}
          placeholder="Tuliskan isi email lamaran di sini..."
        />
      </div>

      {/* Chatbot Revision AI */}
      <form onSubmit={handleRevisionSubmit} className="relative mt-2">
        <input 
          type="text"
          value={revisionPrompt}
          onChange={(e) => setRevisionPrompt(e.target.value)}
          placeholder={isRevising ? "AI sedang merevisi..." : "Minta AI merevisi teks (misal: 'Buat lebih kasual')"}
          disabled={isRevising}
          className="w-full rounded-full px-4 py-2 text-sm pr-10 disabled:opacity-50 focus:outline-none focus:ring-1 transition-all"
          style={{ ...inputStyle, borderRadius: '9999px' }}
        />
        <button 
          type="submit"
          disabled={isRevising}
          className="absolute right-1.5 top-1.5 p-1.5 rounded-full transition-colors"
          style={isRevising ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' } : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          {isRevising ? <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}></div> : <Sparkles size={14} />}
        </button>
      </form>

      {/* CV Selection */}
      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Pilih CV yang dilampirkan</label>
        <div className="flex items-center gap-2">
          <select 
            value={selectedCV}
            onChange={(e) => onCVChange(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={inputStyle}
          >
            <option value="">-- Tidak melampirkan CV --</option>
            {cvHistory.map(cv => (
              <option key={cv.id} value={cv.id}>{cv.name}</option>
            ))}
          </select>
          {selectedCV && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyCV}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold border ${
                cvCopied 
                  ? 'bg-green-500/20 text-green-500 border-green-500/50' 
                  : cvExists === false
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/50'
                    : 'hover:bg-white/5 border-[var(--border)]'
              }`}
              style={{ 
                backgroundColor: (cvCopied || cvExists === false) ? undefined : 'var(--bg-elevated)', 
                color: (cvCopied || cvExists === false) ? undefined : 'var(--text-primary)' 
              }}
              title={cvExists === false ? "File CV hilang. Klik untuk info." : "Salin file CV ke clipboard"}
            >
              <AnimatePresence mode="wait">
                {cvCopied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Berhasil!</span>
                  </motion.div>
                ) : cvExists === false ? (
                  <motion.div
                    key="warning"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <X size={14} />
                    <span>Upload Ulang</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="paperclip"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Paperclip size={14} />
                    <span>Salin CV</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
        {cvHistory.length === 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--status-yellow)' }}>Anda belum mengunggah CV. Buka menu Settings untuk menambahkan CV.</p>
        )}
      </div>

      {/* Action Buttons — Desktop (PC) Layout */}
      <div className="hidden md:grid mt-4 pt-4 grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border)' }}>
        
        <button 
          onClick={() => onSend('gmail')}
          className="font-semibold py-3 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <Send size={14} /> Gmail
        </button>
        
        <button 
          onClick={() => onSend('outlook')}
          className="font-semibold py-3 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <Send size={14} /> Outlook
        </button>
      </div>

      {/* Action Buttons — Mobile Layout */}
      <div className="md:hidden mt-4 pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)' }}>
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            navigator.clipboard.writeText(data.body || '');
            setBodyCopied(true);
            setTimeout(() => setBodyCopied(false), 3000);
            if (notify) notify("Isi email berhasil disalin ke clipboard!", "success");
          }}
          className="w-full font-bold py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
          style={{ 
            backgroundColor: bodyCopied ? 'var(--status-green)' : 'var(--text-primary)', 
            color: bodyCopied ? 'white' : 'var(--text-inverse)' 
          }}
        >
          {bodyCopied ? <><Check size={16} /> Isi Email Tersalin!</> : <><Sparkles size={16} /> Salin Isi Email</>}
        </motion.button>
        
        {(!localStorage.getItem('GMAIL_API_ENABLED') || localStorage.getItem('GMAIL_API_ENABLED') !== 'true') && 
         (!localStorage.getItem('OUTLOOK_API_ENABLED') || localStorage.getItem('OUTLOOK_API_ENABLED') !== 'true') && (
          <button 
            onClick={() => onSend('native')}
            className="w-full font-semibold py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Mail size={16} /> Kirim Email
          </button>
        )}

        {localStorage.getItem('GMAIL_API_ENABLED') === 'true' && (
          <button 
            onClick={() => onSend('gmail')}
            className="w-full font-semibold py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <Send size={14} /> Gmail
          </button>
        )}

        {localStorage.getItem('OUTLOOK_API_ENABLED') === 'true' && (
          <button 
            onClick={() => onSend('outlook')}
            className="w-full font-semibold py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <Send size={14} /> Outlook
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Hapus Template"
        message="Yakin ingin menghapus template ini? Data tidak dapat dikembalikan."
        onConfirm={() => {
          if (confirmModal.targetId) executeDeleteTemplate(confirmModal.targetId);
        }}
        onCancel={() => setConfirmModal({ isOpen: false, targetId: null })}
      />
    </motion.div>
  );
};

export default ResultForm;
