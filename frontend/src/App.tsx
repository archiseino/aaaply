import { useState, useEffect } from 'react';
import { Settings, FileText, X, Image as ImageIcon, LayoutDashboard, Send as SendIcon, Sparkles, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from './components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { rotateApiKey } from './utils/apiManager';
import { set as setDb, get as getDb } from 'idb-keyval';
import { sendGmailWithAttachment, isGmailApiConfigured } from './utils/gmailApi';
import { sendOutlookWithAttachment, isOutlookApiConfigured } from './utils/outlookApi';
import Dropzone from './components/Dropzone';
import ResultForm from './components/ResultForm';
import SettingsModal from './components/SettingsModal';
import Tracker, { type JobApplication } from './components/Tracker';
import Toast, { type ToastType } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import JobFinder from './components/JobFinder';
import { Briefcase } from 'lucide-react';
import { syncFromSheets, syncAppend, syncUpdate, syncDelete } from './utils/sheetsSync';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'apply' | 'tracker' | 'jobfinder'>('apply');
  const [inputType, setInputType] = useState<'image' | 'text'>('image');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    hr_email?: string, 
    subject?: string, 
    body?: string, 
    company_name?: string, 
    job_title?: string,
    context_text?: string,
    cv_text?: string
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [cvHistory, setCvHistory] = useState<{id: string; name: string; size: number; text?: string; filename?: string}[]>([]);
  const [selectedCV, setSelectedCV] = useState<string>('');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{id: string; type: ToastType; message: string}[]>([]);
  const [infoModal, setInfoModal] = useState<{isOpen: boolean, type: 'about' | 'privacy' | null}>({ isOpen: false, type: null });
  const [duplicateModal, setDuplicateModal] = useState<{isOpen: boolean, data: any | null}>({ isOpen: false, data: null });
  const [sheetId, setSheetId] = useState(() => localStorage.getItem('SOBAT_SHEET_ID') || '');
  const [startCell, setStartCell] = useState(() => localStorage.getItem('SOBAT_START_CELL') || 'B7');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const notify = (message: string, type: ToastType = 'info') => {
    // Anti-loop: don't add duplicate messages that are already showing
    setNotifications(prev => {
      if (prev.some(n => n.message === message)) return prev;
      // Cap at 3 toasts max to prevent flooding
      const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
      return [...trimmed, { id: Date.now().toString(), type, message }];
    });
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearInput = () => {
    setFile(null);
    setTextInput('');
    setResult(null);
    setIsProcessing(false);
    setEditingAppId(null);
  };

  // Load CV History
  const loadCVHistory = () => {
    const storedCVs = localStorage.getItem('APPLYBOT_CVS');
    if (storedCVs) {
      try {
        const parsed = JSON.parse(storedCVs);
        setCvHistory(parsed);
      } catch (e) {
        console.error("Failed to parse CV History");
      }
    }
  };

  // Load initial data
  useEffect(() => {
    loadCVHistory();
    const saved = localStorage.getItem('APPLYBOT_TRACKER');
    if (saved) {
      try {
        setApplications(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse tracker data");
      }
    }
  }, []);

  // Save applications to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('APPLYBOT_TRACKER', JSON.stringify(applications));
  }, [applications]);

  const handleCVUpload = async (uploadedFile: File) => {
    setIsProcessing(true);
    // API Key check removed - Backend handles fallback to GEMINI_KEYS

    try {
      const newCV = {
        id: Date.now().toString(),
        name: uploadedFile.name,
        size: uploadedFile.size,
        text: undefined, // Don't extract yet to save API calls
        filename: uploadedFile.name 
      };
      
      // Store Blob in IndexedDB
      await setDb(`cv_blob_${newCV.id}`, uploadedFile);
      
      const updatedHistory = [newCV, ...cvHistory];
      setCvHistory(updatedHistory);
      setSelectedCV(newCV.id); // Auto-select the new CV
      localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updatedHistory));
      notify("CV berhasil ditambahkan. AI akan mengekstraknya saat poster diunggah.", "success");
    } catch (error: any) {
      console.error(error);
      notify("Gagal menyimpan CV: " + error.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform full analysis when both inputs are ready
  const performAnalysis = async () => {
    if ((!file && !textInput.trim()) || !selectedCV || isProcessing) return;
    
    setIsProcessing(true);
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    // API Key check removed

    try {
      let selectedCVItem = cvHistory.find(cv => cv.id === selectedCV);
      let cvText = selectedCVItem?.text;

      // Step 0: Extract CV Text if missing (Lazy Extraction)
      if (!cvText && selectedCVItem) {
        const cvFile = await getDb(`cv_blob_${selectedCV}`);
        if (cvFile) {
          const cvFormData = new FormData();
          cvFormData.append('file', cvFile as File);
          const cvRes = await axios.post(`${API_BASE_URL}/api/extract-cv`, cvFormData, {
            headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': apiKey }
          });
          cvText = cvRes.data.text;
          
          // Save extracted text to history
          const updatedHistory = cvHistory.map(cv => 
            cv.id === selectedCV ? { ...cv, text: cvText } : cv
          );
          setCvHistory(updatedHistory);
          localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updatedHistory));
        }
      }
      
      // Unified Step: Extract & Generate in one go
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('text', textInput);
      }
      formData.append('cv_text', cvText || '');

      const processRes = await axios.post(`${API_BASE_URL}/api/process-all`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': apiKey }
      });
      
      const fullData = processRes.data;

      setResult({
        hr_email: fullData.hr_email,
        company_name: fullData.company_name,
        job_title: fullData.job_title,
        subject: fullData.subject,
        body: fullData.body,
        context_text: fullData.context_text,
        cv_text: cvText
      });

      // Step 3: Check for Duplicate (After generation is complete)
      const isDuplicate = applications.some(app => 
        app.id !== editingAppId && 
        app.companyName.toLowerCase() === fullData.company_name.toLowerCase() &&
        app.jobTitle.toLowerCase() === fullData.job_title.toLowerCase()
      );

      if (isDuplicate) {
        setDuplicateModal({ 
          isOpen: true, 
          data: { extractedData: fullData } 
        });
      }
    } catch (error: any) {
      console.error(error);
      
      // AUTO-ROTATION LOGIC (Error 429 = Too Many Requests / Quota Exceeded)
      if (error.response?.status === 429 || (error.response?.data?.detail && error.response.data.detail.toLowerCase().includes('quota'))) {
        const currentKey = localStorage.getItem('GEMINI_API_KEY') || '';
        const rotated = rotateApiKey(currentKey);
        if (rotated) {
          notify(`Kuota habis. Otomatis beralih ke ${rotated.nextName}...`, "info");
          // Re-run the analysis with the new key after a short delay
          setTimeout(() => performAnalysis(), 1000);
          return;
        }
      }
      
      notify("Gagal menganalisis: " + (error.response?.data?.detail || error.message), "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueAfterDuplicate = () => {
    setDuplicateModal({ isOpen: false, data: null });
  };

  // Auto-trigger analysis
  useEffect(() => {
    if ((file || textInput.trim()) && selectedCV && !result && !isProcessing) {
      performAnalysis();
    }
  }, [file, textInput, selectedCV, result, isProcessing]);

  // CV change no longer resets result — user can switch CV for attachment without re-triggering AI.

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setResult(null); // Clear previous result to trigger new analysis
  };

  // Removed auto-copy useEffect to prevent annoying popups when editing text.

  const copyCVToClipboard = async (cvId: string) => {
    if (!cvId) return false;
    const selectedCVObj = cvHistory.find(cv => cv.id === cvId);
    if (!selectedCVObj) return false;

    console.log(`Attempting to copy CV: ${selectedCVObj.name} (ID: ${cvId})`);

    try {
      const { get } = await import('idb-keyval');
      const cvBlob = await get(`cv_blob_${cvId}`);
      
      if (!(cvBlob instanceof Blob)) {
        console.error(`CV Blob NOT FOUND for ID: ${cvId}. The user probably needs to re-upload.`);
        return false; // ResultForm will handle this by checking cvExists
      }
      
      const mimeType = cvBlob.type || 'application/pdf';
      const file = new File([cvBlob], selectedCVObj.name, { type: mimeType });

      // 1. TRY WEB SHARE API
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `CV - ${selectedCVObj.name}`,
            text: 'Silakan klik "Copy" atau pilih aplikasi email Anda.'
          });
          return true;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return false;
          console.warn("Web Share failed:", shareErr);
        }
      }

      // 2. TRY ASYNC CLIPBOARD API
      try {
        if (typeof ClipboardItem !== 'undefined') {
          const data = [new ClipboardItem({ [mimeType]: file })];
          await navigator.clipboard.write(data);
          return true;
        }
      } catch (clipErr) {
        console.warn("Async Clipboard API failed:", clipErr);
      }

      // 3. TRY LOCAL AJAX BRIDGE
      const clipFormData = new FormData();
      clipFormData.append('file', cvBlob, selectedCVObj.name);
      try {
        const res = await axios.post(`${API_BASE_URL}/api/copy-to-clipboard`, clipFormData);
        if (res.data.status === 'success') return true;
      } catch (e) {
        console.warn("Direct AJAX failed.");
      }

      // 4. THE "HIDDEN BRIDGE"
      const LOCAL_BRIDGE_URL = "http://localhost:8000/api/copy-to-clipboard";
      try {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = LOCAL_BRIDGE_URL;
        form.target = 'cv-bridge-window';
        form.enctype = 'multipart/form-data';
        form.style.display = 'none';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.name = 'file';
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        form.appendChild(fileInput);
        document.body.appendChild(form);

        const bridgeWin = window.open('', 'cv-bridge-window', 'width=350,height=200,left=100,top=100');
        if (bridgeWin) {
          form.submit();
          setTimeout(() => {
            if (document.body.contains(form)) document.body.removeChild(form);
          }, 2000);
          return true;
        }
      } catch (bridgeErr) {}

      return false;
    } catch (e) {
      console.error("Critical failure in copyCVToClipboard:", e);
    }
    return false;
  };



  const handleJobFinderApply = async (job: any) => {
    // Revert to REAL AI Generation based on user request
    const textToProcess = `Posisi: ${job.title}\nPerusahaan: ${job.company}\nURL: ${job.url}\n\n${job.description || ''}`;
    setTextInput(textToProcess);
    setInputType('text');
    setActiveTab('apply');
    
    if (isProcessing) return;
    setIsProcessing(true);
    
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    
    try {
      // Get last selected CV
      let cvTextStr = "";
      const storedCVs = localStorage.getItem('APPLYBOT_CVS');
      if (storedCVs) {
        try {
          const cvs = JSON.parse(storedCVs);
          const activeCV = cvs.find((c: any) => c.id === selectedCV) || (cvs.length > 0 ? cvs[0] : null);
          if (activeCV) {
            if (activeCV.id !== selectedCV) setSelectedCV(activeCV.id);
            cvTextStr = activeCV.text || "";
          }
        } catch (e) {}
      }

      const formData = new FormData();
      formData.append('text', textToProcess);
      formData.append('cv_text', cvTextStr || '');

      const processRes = await axios.post(`${API_BASE_URL}/api/process-all`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': apiKey }
      });
      
      const fullData = processRes.data;

      setResult({
        hr_email: job.email || fullData.hr_email || '',
        company_name: job.company || fullData.company_name,
        job_title: job.title || fullData.job_title,
        subject: fullData.subject,
        body: fullData.body,
        context_text: fullData.context_text,
        cv_text: cvTextStr
      });

      notify("AI berhasil menganalisis loker dan membuat draf email!", "success");
    } catch (error: any) {
      console.error(error);
      notify("Gagal memproses dengan AI: " + (error.response?.data?.detail || error.message), "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async (method: 'outlook' | 'gmail' | 'native') => {
    if (!result) return;
    
    const addApplication = () => {
      const newApp: JobApplication = {
        id: editingAppId || Date.now().toString(),
        companyName: result?.company_name || 'Perusahaan Tidak Diketahui',
        jobTitle: result?.job_title || 'Posisi Tidak Diketahui',
        hrEmail: result?.hr_email || '-',
        dateApplied: new Date().toISOString(),
        status: 'Applied',
        subject: result?.subject,
        body: result?.body,
        contextText: result?.context_text || textInput
      };
      
      if (editingAppId) {
        setApplications(prev => prev.map(app => app.id === editingAppId ? { ...newApp, dateApplied: app.dateApplied } : app));
        setEditingAppId(null);
      } else {
        setApplications(prev => [newApp, ...prev]);
      }
      
      clearInput();
      setActiveTab('tracker');
    };

    // Helper: Get CV Blob from IndexedDB
    const getCVBlob = async (): Promise<{ blob: Blob; name: string } | null> => {
      if (!selectedCV) return null;
      const cvObj = cvHistory.find(cv => cv.id === selectedCV);
      if (!cvObj) return null;
      const blob = await getDb(`cv_blob_${cvObj.id}`);
      if (blob instanceof Blob) return { blob, name: cvObj.name };
      return null;
    };

    // ===== GMAIL API DRAFT (Zero Friction — CV auto-attached) =====
    const isGmailEnabled = localStorage.getItem('GMAIL_API_ENABLED') === 'true';
    if (method === 'gmail' && isGmailApiConfigured() && isGmailEnabled) {
      try {
        const cv = await getCVBlob();
        if (!cv) {
          notify("File CV tidak ditemukan. Upload ulang CV di Pengaturan.", "error");
          return;
        }

        notify("Mengirim email via Gmail...", "info");

        const res = await sendGmailWithAttachment({
          to: result.hr_email || '',
          subject: result.subject || '',
          body: result.body || '',
          cvBlob: cv.blob,
          cvName: cv.name,
        });

        if (res.success) {
          notify("✅ Email berhasil dikirim via Gmail!", "success");
          addApplication();
          handleSyncToSheets().catch(() => {});
        } else {
          notify(res.error || "Gagal mengirim email Gmail.", "error");
        }
      } catch (e: any) {
        notify("Gmail API error: " + (e.message || "Unknown"), "error");
      }
      return;
    }

    // ===== OUTLOOK API DRAFT (Zero Friction — CV auto-attached) =====
    const isOutlookEnabled = localStorage.getItem('OUTLOOK_API_ENABLED') === 'true';
    if (method === 'outlook' && isOutlookApiConfigured() && isOutlookEnabled) {
      try {
        const cv = await getCVBlob();
        if (!cv) {
          notify("File CV tidak ditemukan. Upload ulang CV di Pengaturan.", "error");
          return;
        }

        notify("Mengirim email via Outlook...", "info");

        const res = await sendOutlookWithAttachment({
          to: result.hr_email || '',
          subject: result.subject || '',
          body: result.body || '',
          cvBlob: cv.blob,
          cvName: cv.name,
        });

        if (res.success) {
          notify("✅ Email berhasil dikirim via Outlook!", "success");
          addApplication();
          handleSyncToSheets().catch(() => {});
        } else {
          notify(res.error || "Gagal mengirim email Outlook.", "error");
        }
      } catch (e: any) {
        notify("Outlook API error: " + (e.message || "Unknown"), "error");
      }
      return;
    }

    // ===== FALLBACK: URL-based compose (No API configured) =====
    const subject = encodeURIComponent(result?.subject || '');
    const body = encodeURIComponent(result?.body || '');
    const to = encodeURIComponent(result?.hr_email || '');

    if (method === 'gmail') {
      const gmailUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      notify("Gmail dibuka. Lampirkan CV secara manual atau setup Gmail API di Pengaturan.", "info");
    } else if (method === 'outlook') {
      const outlookUrl = `https://outlook.live.com/owa/?path=/mail/action/compose&to=${to}&subject=${subject}&body=${body}`;
      window.open(outlookUrl, '_blank');
      notify("Outlook dibuka. Lampirkan CV secara manual atau setup Outlook API di Pengaturan.", "info");
    } else if (method === 'native') {
      const mailtoUrl = `mailto:${result?.hr_email || ''}?subject=${subject}&body=${body}`;
      window.location.href = mailtoUrl;
      notify("Membuka aplikasi email bawaan...", "info");
    }

    addApplication();
  };

  // Removed duplicate clearInput

  const handleEditApplication = (app: JobApplication) => {
    setEditingAppId(app.id);
    
    // Load CV text from currently selected CV so revisions retain context
    let cvTextFromHistory = '';
    if (selectedCV) {
      const cvItem = cvHistory.find(cv => cv.id === selectedCV);
      if (cvItem?.text) cvTextFromHistory = cvItem.text;
    }
    // Fallback: try first CV with text if no CV is selected
    if (!cvTextFromHistory && cvHistory.length > 0) {
      const firstWithText = cvHistory.find(cv => cv.text);
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
      cv_text: cvTextFromHistory
    });
    
    if (app.contextText) {
      setTextInput(app.contextText);
      setInputType('text');
    }
    
    setActiveTab('apply');
  };

  const handleUpdateStatus = async (id: string, newStatus: JobApplication['status']) => {
    const prev = applications.find(a => a.id === id);
    const prevStatus = prev?.status;

    setApplications(prev =>
      prev.map(app => app.id === id ? { ...app, status: newStatus } : app)
    );

    if (prev?.sheetRowIndex) {
      const { sheetId: sid, startCell: sc } = getSheetCfg();
      if (sid) {
        const { success, error } = await syncUpdate(sid, sc, prev.sheetRowIndex, {
          status: newStatus,
        });
        if (!success) {
          setApplications(p =>
            p.map(app => app.id === id ? { ...app, status: prevStatus || 'Applied' } : app)
          );
          notify("Gagal sync ke Google Sheets: " + (error || "Unknown"), "error");
        } else {
          notify("Status tersimpan ke Google Sheets ✅", "success");
        }
      }
    }
  };

  const handleDeleteApplication = async (id: string) => {
    const deleted = applications.find(a => a.id === id);
    setApplications(prev => prev.filter(app => app.id !== id));

    if (deleted?.sheetRowIndex) {
      const { sheetId: sid, startCell: sc } = getSheetCfg();
      if (sid) {
        const { success, error } = await syncDelete(sid, sc, deleted.sheetRowIndex);
        if (!success) {
          setApplications(prev => [deleted, ...prev]);
          notify("Gagal hapus dari Google Sheets: " + (error || "Unknown"), "error");
        } else {
          notify("Dihapus dari Google Sheets ✅", "success");
        }
      }
    }
  };

  const handleAddManualApplication = (newApp: JobApplication) => {
    setApplications(prev => [newApp, ...prev]);
    notify("Lamaran manual berhasil ditambahkan!", "success");
  };

  const getSheetCfg = () => ({
    sheetId: localStorage.getItem('SOBAT_SHEET_ID') || sheetId,
    startCell: localStorage.getItem('SOBAT_START_CELL') || startCell,
  });

  const handleSyncFromSheets = async (): Promise<JobApplication[]> => {
    const { sheetId: sid, startCell: sc } = getSheetCfg();
    if (!sid) {
      notify("Sheet ID belum dikonfigurasi. Isi di Pengaturan.", "warning");
      return [];
    }
    const { apps, error } = await syncFromSheets(sid, sc);
    if (error) {
      notify("Sync error: " + error, "error");
      return [];
    }
    const now = new Date().toISOString();
    const loaded: JobApplication[] = apps.map((s, idx) => ({
      id: `sheet-${s.row_index || idx}-${Date.now()}`,
      companyName: s.company,
      jobTitle: s.job_title,
      hrEmail: '',
      location: s.location || '',
      method: s.method || '',
      dateApplied: s.date_applied || now,
      status: (s.status as JobApplication['status']) || 'Applied',
      sheetRowIndex: s.row_index,
    }));
    setApplications(loaded);
    const nowStr = new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setLastSyncedAt(`Sync: ${nowStr}`);
    notify(`${loaded.length} aplikasi dimuat dari Google Sheets`, "success");
    return loaded;
  };

  const handleSyncToSheets = async (): Promise<{success: boolean; errors?: string[]}> => {
    const { sheetId: sid, startCell: sc } = getSheetCfg();
    if (!sid) {
      notify("Sheet ID belum dikonfigurasi. Isi di Pengaturan.", "warning");
      return { success: false, errors: ['No Sheet ID'] };
    }
    const errors: string[] = [];
    let synced = 0;
    const toAppend = applications.filter(a => !a.sheetRowIndex);
    for (const app of toAppend) {
      const { success, error } = await syncAppend(sid, sc, {
        company: app.companyName,
        job_title: app.jobTitle,
        location: app.location,
        date_applied: app.dateApplied,
        method: app.method || (app.hrEmail !== '-' ? `Email: ${app.hrEmail}` : ''),
        status: app.status,
        notes: '',
      });
      if (success) synced++;
      else errors.push(`${app.companyName}: ${error}`);
    }
    if (synced > 0) {
      const { apps } = await syncFromSheets(sid, sc);
      if (apps.length > 0) {
        const now = new Date().toISOString();
        const reloaded: JobApplication[] = apps.map((s, idx) => ({
          id: `sheet-${s.row_index || idx}-${Date.now()}`,
          companyName: s.company,
          jobTitle: s.job_title,
          hrEmail: '',
          location: s.location || '',
          method: s.method || '',
          dateApplied: s.date_applied || now,
          status: (s.status as JobApplication['status']) || 'Applied',
          sheetRowIndex: s.row_index,
        }));
        setApplications(reloaded);
      }
    }
    const nowStr = new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setLastSyncedAt(`Sync: ${nowStr}`);
    if (errors.length === 0) notify(`${synced} aplikasi baru tersimpan ke Google Sheets ✅`, "success");
    else notify(`${synced} tersimpan, ${errors.length} gagal`, "warning");
    return { success: errors.length === 0, errors };
  };

  const isImage = file?.type.startsWith('image/');
  const fileUrl = file ? URL.createObjectURL(file) : null;

  // Listen for paste events from Snipping Tool or clipboard
  useEffect(() => {
    if (activeTab !== 'apply') return; // Only listen on apply tab

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
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl, activeTab]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row font-sans overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      
      {/* Mobile Header */}
      <header className="md:hidden h-16 flex items-center justify-between px-6 z-30 shrink-0" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="SobatApply" className="h-6" style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-0 md:relative md:flex w-64 flex-col z-40 shrink-0 transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
        <div className="h-16 hidden md:flex items-center px-6 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src="/logo.png" alt="SobatApply" className="h-5" style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }} />
          <span className="ml-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>by Doni</span>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('apply'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors`}
            style={activeTab === 'apply' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
          >
            <SendIcon size={18} /> Lamaran Baru
          </button>
          <button
            onClick={() => { setActiveTab('tracker'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors`}
            style={activeTab === 'tracker' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
          >
            <LayoutDashboard size={18} /> Riwayat Lamaran
            {applications.length > 0 && (
              <span className="ml-auto text-xs py-0.5 px-2 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{applications.length}</span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('jobfinder'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors`}
            style={activeTab === 'jobfinder' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
          >
            <Briefcase size={18} /> Cari Lowongan
          </button>
        </nav>

        <div className="p-4 shrink-0 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={toggleTheme} className="w-full hidden md:flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </button>
          <button 
            onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Settings size={18} /> Pengaturan
          </button>
          
          <div className="mt-2 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
            <button 
              onClick={() => setInfoModal({ isOpen: true, type: 'about' })}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-colors opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-secondary)' }}
            >
              Tentang Kami
            </button>
            <button 
              onClick={() => setInfoModal({ isOpen: true, type: 'privacy' })}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-colors opacity-60 hover:opacity-100"
              style={{ color: 'var(--text-secondary)' }}
            >
              Kebijakan Privasi
            </button>
          </div>
        </div>
      </aside>

      {/* Modern Mobile Bottom Navigation (Glassmorphism) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-6 pt-2 backdrop-blur-xl border-t" 
           style={{ 
             backgroundColor: 'color-mix(in srgb, var(--bg-card) 80%, transparent)', 
             borderColor: 'var(--border)',
             paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
             height: 'auto'
           }}>
        <button 
          onClick={() => setActiveTab('apply')}
          className="flex flex-col items-center gap-1 transition-all"
          style={{ color: activeTab === 'apply' ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <SendIcon size={20} className={activeTab === 'apply' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold">Lamaran</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('jobfinder')}
          className="flex flex-col items-center gap-1 transition-all"
          style={{ color: activeTab === 'jobfinder' ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <Briefcase size={20} className={activeTab === 'jobfinder' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold">Lowongan</span>
        </button>

        <button 
          onClick={() => setActiveTab('tracker')}
          className="flex flex-col items-center gap-1 transition-all"
          style={{ color: activeTab === 'tracker' ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <LayoutDashboard size={20} className={activeTab === 'tracker' ? 'scale-110' : ''} />
          <span className="text-[10px] font-bold">Riwayat</span>
        </button>

        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center gap-1 transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          <Settings size={20} />
          <span className="text-[10px] font-bold">Pengaturan</span>
        </button>
      </div>

      {/* Padding for Bottom Nav on Mobile Content */}
      <style>{`
        @media (max-width: 768px) {
          main { padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative" style={{ backgroundColor: 'var(--bg-main)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'apply' ? (
            <motion.div 
              key="apply"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col md:flex-row w-full h-full overflow-y-auto md:overflow-hidden relative"
            >
              {isProcessing && (
                <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center flex-col gap-4 z-[60]" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-main) 85%, transparent)' }}>
                  <div className="w-14 h-14 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-primary)' }}></div>
                  <div className="flex flex-col items-center gap-1.5 px-6 text-center">
                    <p className="text-base font-bold tracking-wide animate-pulse" style={{ color: 'var(--text-primary)' }}>AI Sedang Memproses...</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Menganalisis loker & membuat draf email terbaik untuk Anda</p>
                  </div>
                </div>
              )}
              {/* Left Panel - Upload & Preview */}
              <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-visible md:overflow-y-auto relative shrink-0 md:shrink pb-24 md:pb-6 border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="flex p-1 rounded-lg shrink-0 mb-6" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <button
                    onClick={() => setInputType('image')}
                    className="flex-1 py-2 text-sm font-semibold rounded-md transition-colors"
                    style={inputType === 'image' ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}
                  >
                    Upload Gambar
                  </button>
                  <button
                    onClick={() => setInputType('text')}
                    className="flex-1 py-2 text-sm font-semibold rounded-md transition-colors"
                    style={inputType === 'text' ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}
                  >
                    Paste Teks
                  </button>
                </div>

                {inputType === 'image' ? (
                  <div className="flex flex-col">
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Upload Poster Lowongan</h2>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Upload poster atau screenshot loker. AI akan otomatis membaca informasinya.</p>
                      
                      {!file ? (
                        <Dropzone onUpload={handleFileUpload} title="Drag & drop poster di sini" id="poster-upload" />
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-xl overflow-hidden flex flex-col relative shrink-0"
                          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
                        >
                          <button 
                            onClick={clearInput}
                            className="absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-colors z-10"
                            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                            title="Hapus poster"
                          >
                            <X size={16} />
                          </button>

                          {isImage && fileUrl ? (
                            <div className="w-full h-48 flex items-center justify-center overflow-hidden relative group" style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                              <img src={fileUrl} alt="Preview" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                              <FileText size={48} style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          
                          <div className="p-4 flex items-center gap-4 shrink-0" style={{ backgroundColor: 'var(--bg-card)' }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                              {isImage ? <ImageIcon size={20} style={{ color: 'var(--text-secondary)' }} /> : <FileText size={20} style={{ color: 'var(--text-secondary)' }} />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</h3>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 gap-6">
                    <div className="flex-1 flex flex-col min-h-0">
                      <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Paste Teks Lowongan</h2>
                      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Copy-paste detail lowongan dari platform manapun.</p>
                      <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Paste deskripsi pekerjaan di sini..."
                        className="flex-1 w-full rounded-xl p-4 text-sm transition-all resize-none focus:outline-none focus:ring-1"
                        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Right Panel - CV Selection or Results */}
              <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-visible md:overflow-y-auto relative shrink-0 md:shrink pb-24 md:pb-6">
                <AnimatePresence mode="wait">
                  {result ? (
                    <ResultForm 
                      data={result} 
                      cvHistory={cvHistory}
                      selectedCV={selectedCV}
                      onCVChange={setSelectedCV}
                      onChange={setResult}
                      onSend={handleSend}
                      onCopyFileCV={() => copyCVToClipboard(selectedCV)}
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
                      {/* Top Bar - Functional Dropdown */}
                      <div className="relative p-1 rounded-lg shrink-0 mb-6 flex" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                        <select 
                          value={selectedCV}
                          onChange={(e) => setSelectedCV(e.target.value)}
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
                          <Dropzone onUpload={handleCVUpload} title="Drag & drop CV (PDF) di sini" id="cv-upload-right" notify={notify} />
                        </div>

                        {!file && !textInput.trim() && (
                          <div className="mt-auto pt-8 flex flex-col items-center text-center opacity-30">
                            <Sparkles size={32} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-xs max-w-[200px]" style={{ color: 'var(--text-muted)' }}>Setelah CV dipilih dan poster diunggah, AI akan otomatis bekerja.</p>
                          </div>
                        )}
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : activeTab === 'jobfinder' ? (
            <motion.div
              key="jobfinder"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full overflow-hidden flex flex-col"
            >
              <JobFinder 
                onApply={handleJobFinderApply}
                onAddExternalApplication={(app) => setApplications(prev => [app, ...prev])}
                notify={notify}
              />
            </motion.div>
          ) : (
            <motion.div
              key="tracker"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full overflow-hidden flex flex-col"
            >
              <Tracker 
                applications={applications} 
                onUpdateStatus={handleUpdateStatus} 
                onDelete={handleDeleteApplication}
                onEdit={handleEditApplication}
                onAdd={handleAddManualApplication}
                sheetId={sheetId}
                onSyncFromSheets={handleSyncFromSheets}
                onSyncToSheets={handleSyncToSheets}
                lastSyncedAt={lastSyncedAt}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            onClose={() => {
              setIsSettingsOpen(false);
              loadCVHistory();
              setSheetId(localStorage.getItem('SOBAT_SHEET_ID') || '');
              setStartCell(localStorage.getItem('SOBAT_START_CELL') || 'B7');
            }} 
            notify={notify}
          />
        )}
      </AnimatePresence>

      {/* Duplicate Check Modal */}
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

      {/* Info Modal */}
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
                  <p className="mb-4">
                    SobatApply adalah asisten cerdas berbasis Artificial Intelligence (AI) yang dirancang khusus untuk membantu para pencari kerja di Indonesia dalam menyusun strategi lamaran kerja yang lebih efektif dan profesional.
                  </p>
                  <p className="mb-4">
                    Kami memahami bahwa setiap lowongan kerja adalah unik. Oleh karena itu, SobatApply menggunakan teknologi Gemini AI untuk menganalisis deskripsi pekerjaan dan menyesuaikan (tailoring) draf email lamaran serta CV Anda agar memiliki relevansi yang maksimal.
                  </p>
                  <h3 className="text-lg font-bold mt-6 mb-2">Visi Kami</h3>
                  <p>Membantu jutaan talenta Indonesia mendapatkan pekerjaan impian mereka dengan bantuan teknologi AI yang etis dan mudah diakses.</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="text-blue-500" /> Privacy Policy
                  </h2>
                  <p className="text-sm text-gray-400 mb-4 italic">Terakhir diperbarui: 13 Mei 2026</p>
                  
                  <h3 className="text-lg font-bold mt-6 mb-2">1. Pengolahan Data CV</h3>
                  <p className="mb-4 text-sm leading-relaxed">
                    SobatApply sangat menghargai privasi Anda. File CV yang Anda unggah diproses melalui memori lokal (IndexedDB) di browser Anda. Kami hanya mengirimkan konten teks dari CV Anda ke server Google Gemini untuk keperluan ekstraksi data dan pembuatan draf email.
                  </p>
                  
                  <h3 className="text-lg font-bold mt-6 mb-2">2. Keamanan Data</h3>
                  <p className="mb-4 text-sm leading-relaxed">
                    Kami tidak menyimpan salinan file CV Anda di database kami secara permanen. Data CV Anda hanya ada selama sesi penggunaan aplikasi dan akan tetap berada di perangkat Anda kecuali Anda menghapusnya secara manual melalui menu Settings.
                  </p>
                  
                  <h3 className="text-lg font-bold mt-6 mb-2">3. Layanan Pihak Ketiga</h3>
                  <p className="mb-4 text-sm leading-relaxed">
                    Aplikasi ini menggunakan API Google Gemini untuk pemrosesan AI. Penggunaan data oleh Google tunduk pada Kebijakan Privasi Google. Kami tidak menjual data pribadi Anda kepada pihak ketiga manapun.
                  </p>
                  
                  <h3 className="text-lg font-bold mt-6 mb-2">4. Persetujuan</h3>
                  <p className="text-sm leading-relaxed">
                    Dengan menggunakan SobatApply, Anda setuju dengan pengolahan data sebagaimana dijelaskan dalam kebijakan ini untuk tujuan mempersonalisasi lamaran kerja Anda.
                  </p>
                </div>
              )}
              
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
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

      {/* Notifications */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <div key={n.id} className="pointer-events-auto">
              <Toast 
                id={n.id} 
                type={n.type} 
                message={n.message} 
                onClose={removeNotification} 
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
