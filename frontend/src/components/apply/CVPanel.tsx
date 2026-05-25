import { ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dropzone from '../ui/Dropzone';
import ResultForm from './ResultForm';
import type { ResultData } from '../../hooks/useAIProcess';
import type { CVItem } from '../../hooks/useCVManager';
import type { ToastType } from '../ui/Toast';

interface CVPanelProps {
  result: ResultData | null;
  cvHistory: CVItem[];
  selectedCV: string;
  onCVChange: (id: string) => void;
  onCVUpload: (file: File) => void;
  onSend: (method: 'outlook' | 'gmail' | 'native') => void;
  onCopyFileCV: () => Promise<boolean>;
  onChange: (data: ResultData) => void;
  notify: (msg: string, type?: ToastType) => void;
  file: File | null;
  textInput: string;
}

export function CVPanel({
  result,
  cvHistory,
  selectedCV,
  onCVChange,
  onCVUpload,
  onSend,
  onCopyFileCV,
  onChange,
  notify,
  file,
  textInput,
}: CVPanelProps) {
  return (
    <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-visible md:overflow-y-auto relative shrink-0 md:shrink pb-24 md:pb-6">
      <AnimatePresence mode="wait">
        {result ? (
          <ResultForm
            key="result-form"
            data={result}
            cvHistory={cvHistory}
            selectedCV={selectedCV}
            onCVChange={onCVChange}
            onChange={onChange}
            onSend={onSend}
            onCopyFileCV={onCopyFileCV}
            notify={notify}
          />
        ) : (
          <motion.div
            key="cv-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full"
          >
            <div className="relative p-1 rounded-lg shrink-0 mb-6 flex" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <select
                value={selectedCV}
                onChange={(e) => onCVChange(e.target.value)}
                className="w-full py-2 text-sm font-semibold rounded-md text-center cursor-pointer appearance-none outline-none pr-8"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                <option value="">Pilih Curriculum Vitae (CV)</option>
                {cvHistory.map(cv => (
                  <option key={cv.id} value={cv.id}>{cv.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                <ChevronDown size={16} />
              </div>
            </div>

            <div className="flex flex-col h-full">
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Upload Curriculum Vitae (CV)</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Lengkapi dengan CV Anda agar AI bisa mempersonalisasi lamaran secara otomatis.</p>

              <div className="flex flex-col">
                <Dropzone onUpload={onCVUpload} title="Drag & drop CV (PDF) di sini" id="cv-upload-right" notify={notify} />
              </div>

              {!file && !textInput.trim() && (
                <div className="mt-auto pt-8 flex flex-col items-center text-center opacity-30">
                  <Sparkles size={32} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                    Setelah CV dipilih dan poster diunggah, AI akan otomatis bekerja.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
