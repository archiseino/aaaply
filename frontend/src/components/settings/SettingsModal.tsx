import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, File, Check, UploadCloud, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { set as setDb, del as delDb } from 'idb-keyval';


const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface SettingsModalProps {
  onClose: () => void;
  notify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface CVFile {
  id: string;
  name: string;
  size: number;
  text?: string;
  filename?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, notify }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [cvHistory, setCvHistory] = useState<CVFile[]>([]);
  const [activeTab, setActiveTab] = useState<'api' | 'cv'>('cv');
  const [isExtracting, setIsExtracting] = useState(false);
  const [gmailApiEnabled, setGmailApiEnabled] = useState(false);
  const [outlookApiEnabled, setOutlookApiEnabled] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [startCell, setStartCell] = useState('B7');

  useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY') || '';
    setApiKey(storedKey);
    const storedCVs = localStorage.getItem('APPLYBOT_CVS');
    if (storedCVs) { try { setCvHistory(JSON.parse(storedCVs)); } catch(e) {} }
    setGmailApiEnabled(localStorage.getItem('GMAIL_API_ENABLED') === 'true');
    setOutlookApiEnabled(localStorage.getItem('OUTLOOK_API_ENABLED') === 'true');
    const storedSheetId = localStorage.getItem('SOBAT_SHEET_ID') || '';
    setSheetId(storedSheetId);
    const storedStartCell = localStorage.getItem('SOBAT_START_CELL') || 'B7';
    setStartCell(storedStartCell);
  }, []);

  const handleSave = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('APPLYBOT_CVS', JSON.stringify(cvHistory));
    localStorage.setItem('GMAIL_API_ENABLED', String(gmailApiEnabled));
    localStorage.setItem('OUTLOOK_API_ENABLED', String(outlookApiEnabled));
    localStorage.setItem('SOBAT_SHEET_ID', sheetId);
    localStorage.setItem('SOBAT_START_CELL', startCell);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const handleCVDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setIsExtracting(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const currentApiKey = apiKey || localStorage.getItem('GEMINI_API_KEY');
          if (!currentApiKey) {
            const msg = "Harap isi dan simpan API Key terlebih dahulu sebelum mengunggah CV.";
            if (notify) notify(msg, "warning"); else alert(msg);
            setIsExtracting(false);
            return;
          }
          const res = await axios.post(`${API_BASE_URL}/api/extract-cv`, formData, {
            headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': currentApiKey }
          });
          const newCV: CVFile = { id: Date.now().toString(), name: file.name, size: file.size, text: res.data.text, filename: file.name };
          await setDb(`cv_blob_${newCV.id}`, file);
          setCvHistory(prev => [newCV, ...prev]);
        } catch (error) {
          console.error(error);
          if (notify) notify("Gagal mengekstrak teks dari CV.", "error"); else alert("Gagal mengekstrak teks dari CV.");
        } finally {
          setIsExtracting(false);
        }
      } else {
        if (notify) notify("Hanya format PDF yang didukung untuk CV.", "warning"); else alert("Hanya format PDF yang didukung untuk CV.");
      }
    }
  }, []);

  const handleDeleteCV = async (id: string) => {
    await delDb(`cv_blob_${id}`);
    setCvHistory(prev => prev.filter(cv => cv.id !== id));
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex gap-4">
            {(['cv', 'api'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-sm font-bold transition-colors pb-1"
                style={activeTab === tab 
                  ? { color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)' } 
                  : { color: 'var(--text-muted)' }}
              >
                {tab === 'cv' ? 'CV Manager' : 'API Keys'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-1 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {activeTab === 'api' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Custom Gemini API Key</label>
                <input 
                  type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 transition-all"
                  style={inputStyle} placeholder="AIzaSy..."
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tempel key Anda di sini jika ingin menggunakan kuota pribadi.</p>
              </div>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Integrasi Email Draf (Zero Friction)</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gmailApiEnabled} onChange={(e) => setGmailApiEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Aktifkan Integrasi Draf Gmail API</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={outlookApiEnabled} onChange={(e) => setOutlookApiEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Aktifkan Integrasi Draf Outlook API</span>
                </label>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Jika dimatikan, tombol Gmail/Outlook akan menggunakan cara standar tanpa otomatisasi pelampiran CV.</p>
              </div>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Google Sheets ID (Sync Tracker)</label>
                <input
                  type="text" value={sheetId} onChange={(e) => setSheetId(e.target.value)}
                  className="w-full rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 transition-all"
                  style={inputStyle} placeholder="1a2B3cD4eF5g6H7iJ8kL9mN"
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Buat Google Sheet, share dengan service account, lalu tempel ID Sheet di sini. Gunakan tombol Sync di halaman Tracker.</p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Start Cell</label>
                <input
                  type="text" value={startCell} onChange={(e) => setStartCell(e.target.value)}
                  className="w-full rounded-lg px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-1 transition-all"
                  style={inputStyle} placeholder="B7"
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sel pertama tempat data dimulai (contoh: B7 jika header di baris 5, data mulai baris 7 kolom B).</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCVDrop}
                className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}
              >
                <UploadCloud className="mb-2" size={28} style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Drag & Drop file CV ke sini</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Hanya format PDF</p>
              </div>

              {isExtracting && (
                <p className="text-sm text-center animate-pulse" style={{ color: 'var(--text-secondary)' }}>Sedang mengekstrak teks CV...</p>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>CV History</h3>
                {cvHistory.length === 0 ? (
                  <div className="text-center p-4 border border-dashed rounded-lg text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    Belum ada CV yang tersimpan.
                  </div>
                ) : (
                  cvHistory.map((cv) => (
                    <div key={cv.id} className="flex items-center justify-between p-3 rounded-lg group transition-colors" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <File className="shrink-0" size={18} style={{ color: 'var(--text-secondary)' }} />
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{cv.name}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{(cv.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteCV(cv.id)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-rose-500"
                        title="Hapus CV"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 flex justify-end shrink-0" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
          <button 
            onClick={handleSave}
            className="font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition-all"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saved ? 'Tersimpan!' : 'Simpan Pengaturan'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
