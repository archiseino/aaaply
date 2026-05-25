import { useState, useEffect, useCallback } from 'react';
import { X, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { get as getDb } from 'idb-keyval';

import { useNotifications } from './hooks/useNotifications';
import { useCVManager } from './hooks/useCVManager';
import { useAIProcess } from './hooks/useAIProcess';
import { useTracker } from './hooks/useTracker';

import { MobileHeader } from './components/layout/MobileHeader';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ApplyPage } from './pages/ApplyPage';
import { JobFinderPage } from './pages/JobFinderPage';
import { TrackerPage } from './pages/TrackerPage';
import SettingsModal from './components/settings/SettingsModal';
import { ConfirmModal } from './components/ui/ConfirmModal';
import Toast from './components/ui/Toast';

import { syncAppAndReload, syncJobAppAndReload } from './lib/sheet';
import { copyCVToClipboard } from './lib/clipboard';
import { API_BASE_URL } from './lib/constants';
import {
  sendGmailWithAttachment,
  isGmailApiConfigured,
} from './utils/gmailApi';
import {
  sendOutlookWithAttachment,
  isOutlookApiConfigured,
} from './utils/outlookApi';

function App() {
  const [activeTab, setActiveTab] = useState<'apply' | 'tracker' | 'jobfinder'>('apply');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; type: 'about' | 'privacy' | null }>({
    isOpen: false,
    type: null,
  });
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; data: any | null }>({
    isOpen: false,
    data: null,
  });
  const [sheetId, setSheetId] = useState(() => localStorage.getItem('SOBAT_SHEET_ID') || '');

  const { notifications, notify, removeNotification } = useNotifications();

  const {
    cvHistory,
    selectedCV,
    setSelectedCV,
    setCvHistory,
    loadCVHistory,
    handleCVUpload,
  } = useCVManager({ notify, setIsProcessing });

  const {
    applications,
    setApplications,
    handleUpdateStatus,
    handleDeleteApplication,
    handleEditSave,
    handleAddManualApplication,
    handleSyncFromSheets,
  } = useTracker({ notify });

  const {
    inputType,
    setInputType,
    textInput,
    setTextInput,
    file,
    result,
    setResult,
    handleFileUpload,
    clearInput,
  } = useAIProcess({
    notify,
    isProcessing,
    setIsProcessing,
    cvHistory,
    selectedCV,
    setSelectedCV,
    setCvHistory,
    applications,
    editingAppId,
    setEditingAppId,
    onDuplicateFound: (data) => setDuplicateModal({ isOpen: true, data }),
  });

  const isImage = Boolean(file?.type.startsWith('image/'));
  const fileUrl = file ? URL.createObjectURL(file) : null;

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    if (activeTab !== 'apply') return;
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith('image/')) {
          handleFileUpload(pastedFile);
        }
      }
    };
    window.addEventListener('paste', handlePaste as any);
    return () => {
      window.removeEventListener('paste', handlePaste as any);
    };
  }, [activeTab, handleFileUpload]);

  const handleSend = useCallback(async (method: 'outlook' | 'gmail' | 'native') => {
    if (!result) return;

    const addApplication = () => {
      const newApp = {
        id: editingAppId || Date.now().toString(),
        companyName: result.company_name || 'Perusahaan Tidak Diketahui',
        jobTitle: result.job_title || 'Posisi Tidak Diketahui',
        hrEmail: result.hr_email || '-',
        dateApplied: new Date().toISOString(),
        status: 'Applied' as const,
        subject: result.subject,
        body: result.body,
        contextText: result.context_text || textInput,
      };
      if (editingAppId) {
        setApplications(prev =>
          prev.map(app =>
            app.id === editingAppId ? { ...newApp, dateApplied: app.dateApplied } : app,
          ),
        );
        setEditingAppId(null);
      } else {
        setApplications(prev => [newApp, ...prev]);
      }
      clearInput();
      setActiveTab('tracker');
    };

    const getCVBlob = async (): Promise<{ blob: Blob; name: string } | null> => {
      if (!selectedCV) return null;
      const cvObj = cvHistory.find(cv => cv.id === selectedCV);
      if (!cvObj) return null;
      const blob = await getDb(`cv_blob_${cvObj.id}`);
      if (blob instanceof Blob) return { blob, name: cvObj.name };
      return null;
    };

    const isGmailEnabled = localStorage.getItem('GMAIL_API_ENABLED') === 'true';
    if (method === 'gmail' && isGmailApiConfigured() && isGmailEnabled) {
      try {
        const cv = await getCVBlob();
        if (!cv) {
          notify('File CV tidak ditemukan. Upload ulang CV di Pengaturan.', 'error');
          return;
        }
        notify('Mengirim email via Gmail...', 'info');
        const res = await sendGmailWithAttachment({
          to: result.hr_email || '',
          subject: result.subject || '',
          body: result.body || '',
          cvBlob: cv.blob,
          cvName: cv.name,
        });
        if (res.success) {
          notify('✅ Email berhasil dikirim via Gmail!', 'success');
          addApplication();
          syncAppAndReload(result).catch(() => {});
        } else {
          notify(res.error || 'Gagal mengirim email Gmail.', 'error');
        }
      } catch (e: any) {
        notify('Gmail API error: ' + (e.message || 'Unknown'), 'error');
      }
      return;
    }

    const isOutlookEnabled = localStorage.getItem('OUTLOOK_API_ENABLED') === 'true';
    if (method === 'outlook' && isOutlookApiConfigured() && isOutlookEnabled) {
      try {
        const cv = await getCVBlob();
        if (!cv) {
          notify('File CV tidak ditemukan. Upload ulang CV di Pengaturan.', 'error');
          return;
        }
        notify('Mengirim email via Outlook...', 'info');
        const res = await sendOutlookWithAttachment({
          to: result.hr_email || '',
          subject: result.subject || '',
          body: result.body || '',
          cvBlob: cv.blob,
          cvName: cv.name,
        });
        if (res.success) {
          notify('✅ Email berhasil dikirim via Outlook!', 'success');
          addApplication();
          syncAppAndReload(result).catch(() => {});
        } else {
          notify(res.error || 'Gagal mengirim email Outlook.', 'error');
        }
      } catch (e: any) {
        notify('Outlook API error: ' + (e.message || 'Unknown'), 'error');
      }
      return;
    }

    const subject = encodeURIComponent(result.subject || '');
    const body = encodeURIComponent(result.body || '');
    const to = encodeURIComponent(result.hr_email || '');

    if (method === 'gmail') {
      window.open(
        `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
        '_blank',
      );
      notify('Gmail dibuka. Lampirkan CV secara manual atau setup Gmail API di Pengaturan.', 'info');
    } else if (method === 'outlook') {
      window.open(
        `https://outlook.live.com/owa/?path=/mail/action/compose&to=${to}&subject=${subject}&body=${body}`,
        '_blank',
      );
      notify('Outlook dibuka. Lampirkan CV secara manual atau setup Outlook API di Pengaturan.', 'info');
    } else if (method === 'native') {
      window.location.href = `mailto:${result.hr_email || ''}?subject=${subject}&body=${body}`;
      notify('Membuka aplikasi email bawaan...', 'info');
    }

    addApplication();
    syncAppAndReload(result).catch(() => {});
  }, [result, editingAppId, textInput, selectedCV, cvHistory, setApplications, setEditingAppId, clearInput, notify]);

  const handleJobFinderApply = useCallback(async (job: any) => {
    const textToProcess = `Posisi: ${job.title}\nPerusahaan: ${job.company}\nURL: ${job.url}\n\n${job.description || ''}`;
    setTextInput(textToProcess);
    setInputType('text');
    setActiveTab('apply');

    const isManual = localStorage.getItem('SOBAT_MANUAL_MODE') === 'true';
    if (isManual) {
      setResult({
        hr_email: job.email || '',
        company_name: job.company || '',
        job_title: job.title || '',
      });
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      let cvTextStr = '';
      const storedCVs = localStorage.getItem('APPLYBOT_CVS');
      if (storedCVs) {
        try {
          const cvs = JSON.parse(storedCVs);
          const activeCV = cvs.find((c: any) => c.id === selectedCV) || (cvs.length > 0 ? cvs[0] : null);
          if (activeCV) {
            if (activeCV.id !== selectedCV) setSelectedCV(activeCV.id);
            cvTextStr = activeCV.text || '';
          }
        } catch {}
      }

      const formData = new FormData();
      formData.append('text', textToProcess);
      formData.append('cv_text', cvTextStr || '');

      const processRes = await axios.post(`${API_BASE_URL}/api/process-all`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': localStorage.getItem('GEMINI_API_KEY') },
      });

      const fullData = processRes.data;
      setResult({
        hr_email: job.email || fullData.hr_email || '',
        company_name: job.company || fullData.company_name,
        job_title: job.title || fullData.job_title,
        subject: fullData.subject,
        body: fullData.body,
        context_text: fullData.context_text,
        cv_text: cvTextStr,
      });
      notify('AI berhasil menganalisis loker dan membuat draf email!', 'success');
    } catch (error: any) {
      notify('Gagal memproses dengan AI: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedCV, setSelectedCV, setTextInput, setInputType, setResult, notify, isProcessing, setIsProcessing]);

  const handleEditApplication = useCallback((app: any) => {
    setEditingAppId(app.id);

    let cvTextFromHistory = '';
    if (selectedCV) {
      const cvItem = cvHistory.find((cv: any) => cv.id === selectedCV);
      if (cvItem?.text) cvTextFromHistory = cvItem.text;
    }
    if (!cvTextFromHistory && cvHistory.length > 0) {
      const firstWithText = cvHistory.find((cv: any) => cv.text);
      if (firstWithText) {
        cvTextFromHistory = firstWithText.text!;
        setSelectedCV(firstWithText.id);
      }
    }

    setResult({
      company_name: app.companyName,
      job_title: app.jobTitle,
      hr_email: app.hrEmail,
      subject: app.subject || '',
      body: app.body || '',
      context_text: app.contextText || '',
      cv_text: cvTextFromHistory,
    });

    if (app.contextText) {
      setTextInput(app.contextText);
      setInputType('text');
    }
    setActiveTab('apply');
  }, [selectedCV, cvHistory, setEditingAppId, setResult, setSelectedCV, setTextInput, setInputType]);

  const handleContinueAfterDuplicate = useCallback(() => {
    setDuplicateModal({ isOpen: false, data: null });
  }, []);

  const handleSyncFromSheetsWrapper = useCallback(async (): Promise<any> => {
    return handleSyncFromSheets();
  }, [handleSyncFromSheets]);

  const handleCopyFileCV = useCallback((): Promise<boolean> => {
    return copyCVToClipboard(selectedCV, cvHistory);
  }, [selectedCV, cvHistory]);

  return (
    <div
      className="h-screen w-screen flex flex-col md:flex-row font-sans overflow-hidden"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
    >
      <MobileHeader />

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        applicationsCount={applications.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInfoModal={(type) => setInfoModal({ isOpen: true, type })}
      />

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <style>{`
        @media (max-width: 768px) {
          main { padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      <main
        className="flex-1 flex flex-col overflow-hidden relative"
        style={{ backgroundColor: 'var(--bg-main)' }}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'apply' && (
            <ApplyPage
              isProcessing={isProcessing}
              inputType={inputType}
              onInputTypeChange={setInputType}
              file={file}
              onFileUpload={handleFileUpload}
              textInput={textInput}
              onTextInputChange={setTextInput}
              onClear={clearInput}
              fileUrl={fileUrl}
              isImage={isImage}
              result={result}
              cvHistory={cvHistory}
              selectedCV={selectedCV}
              onCVChange={setSelectedCV}
              onCVUpload={handleCVUpload}
              onSend={handleSend}
              onCopyFileCV={handleCopyFileCV}
              onChange={setResult}
              notify={notify}
            />
          )}
          {activeTab === 'jobfinder' && (
            <JobFinderPage
              onApply={handleJobFinderApply}
              onAddExternalApplication={async (app) => {
                setApplications(prev => [app, ...prev]);
                const reloaded = await syncJobAppAndReload({
                  company: app.companyName,
                  job_title: app.jobTitle,
                  location: app.location,
                  date_applied: app.dateApplied,
                  method: app.method,
                  email: app.hrEmail,
                  status: app.status,
                });
                if (reloaded) setApplications(reloaded);
              }}
              notify={notify}
            />
          )}
          {activeTab === 'tracker' && (
            <TrackerPage
              applications={applications}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteApplication}
              onEdit={handleEditApplication}
              onEditSave={handleEditSave}
              onAdd={handleAddManualApplication}
              sheetId={sheetId}
              onSyncFromSheets={handleSyncFromSheetsWrapper}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            onClose={() => {
              setIsSettingsOpen(false);
              loadCVHistory();
              setSheetId(localStorage.getItem('SOBAT_SHEET_ID') || '');
            }}
            notify={notify}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={duplicateModal.isOpen}
        title="Sudah Melamar?"
        message={`Sepertinya Anda sudah melamar sebagai "${duplicateModal.data?.extractedData?.job_title}" di "${duplicateModal.data?.extractedData?.company_name}" sebelumnya. Tetap lanjut buat lamaran baru?`}
        confirmText="Lanjut"
        cancelText="Batal"
        onConfirm={handleContinueAfterDuplicate}
        onCancel={() => {
          setDuplicateModal({ isOpen: false, data: null });
          clearInput();
        }}
      />

      <AnimatePresence>
        {infoModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-8 relative"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <button
                onClick={() => setInfoModal({ isOpen: false, type: null })}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
              {infoModal.type === 'about' ? (
                <div className="prose prose-invert max-w-none">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="text-blue-500" /> About SobatApply
                  </h2>
                  <p>SobatApply adalah asisten cerdas berbasis Artificial Intelligence (AI) yang dirancang khusus untuk membantu para pencari kerja di Indonesia dalam menyusun strategi lamaran kerja yang lebih efektif dan profesional.</p>
                  <h3 className="text-lg font-bold mt-6 mb-2">Visi Kami</h3>
                  <p>Membantu jutaan talenta Indonesia mendapatkan pekerjaan impian mereka dengan bantuan teknologi AI yang etis dan mudah diakses.</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="text-blue-500" /> Privacy Policy
                  </h2>
                  <p className="text-sm italic mb-4" style={{ color: 'var(--text-muted)' }}>Terakhir diperbarui: 13 Mei 2026</p>
                  <h3 className="text-lg font-bold mt-6 mb-2">1. Pengolahan Data CV</h3>
                  <p className="mb-4 text-sm leading-relaxed">SobatApply sangat menghargai privasi Anda. File CV yang Anda unggah diproses melalui memori lokal (IndexedDB) di browser Anda. Kami hanya mengirimkan konten teks dari CV Anda ke server Google Gemini untuk keperluan ekstraksi data dan pembuatan draf email.</p>
                  <h3 className="text-lg font-bold mt-6 mb-2">2. Keamanan Data</h3>
                  <p className="mb-4 text-sm leading-relaxed">Kami tidak menyimpan salinan file CV Anda di database kami secara permanen. Data CV Anda hanya ada selama sesi penggunaan aplikasi dan akan tetap berada di perangkat Anda kecuali Anda menghapusnya secara manual melalui menu Settings.</p>
                  <h3 className="text-lg font-bold mt-6 mb-2">3. Layanan Pihak Ketiga</h3>
                  <p className="mb-4 text-sm leading-relaxed">Aplikasi ini menggunakan API Google Gemini untuk pemrosesan AI. Penggunaan data oleh Google tunduk pada Kebijakan Privasi Google. Kami tidak menjual data pribadi Anda kepada pihak ketiga manapun.</p>
                  <h3 className="text-lg font-bold mt-6 mb-2">4. Persetujuan</h3>
                  <p className="mb-4 text-sm leading-relaxed">Dengan menggunakan SobatApply, Anda setuju dengan pengolahan data sebagaimana dijelaskan dalam kebijakan ini untuk tujuan mempersonalisasi lamaran kerja Anda.</p>
                </div>
              )}
              <div className="mt-8 pt-6 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setInfoModal({ isOpen: false, type: null })}
                  className="px-6 py-2 rounded-lg font-bold transition-all"
                  style={{ backgroundColor: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                >
                  Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <div key={n.id} className="pointer-events-auto">
              <Toast id={n.id} type={n.type} message={n.message} onClose={removeNotification} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
