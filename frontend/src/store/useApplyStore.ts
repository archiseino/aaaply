import { create } from 'zustand';
import axios from 'axios';
import { get as getDb, set as setDb } from 'idb-keyval';
import { API_BASE_URL } from '../lib/constants';
import type { JobApplication } from '../components/tracker/Tracker';
import { useNotificationStore } from './useNotificationStore';
import { useTrackerStore } from './useTrackerStore';

export interface ResultData {
  hr_email?: string;
  subject?: string;
  body?: string;
  company_name?: string;
  job_title?: string;
  context_text?: string;
  cv_text?: string;
}

export interface CVItem {
  id: string;
  name: string;
  size: number;
  text?: string;
  filename?: string;
}

interface ApplyState {
  inputType: 'image' | 'text';
  setInputType: (type: 'image' | 'text') => void;
  textInput: string;
  setTextInput: (text: string) => void;
  file: File | null;
  result: ResultData | null;
  setResult: (result: ResultData | null) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  duplicateModal: { isOpen: boolean; data: any };
  setDuplicateModal: (modal: { isOpen: boolean; data: any }) => void;
  cvHistory: CVItem[];
  selectedCV: string;
  setSelectedCV: (id: string) => void;
  setCvHistory: (updater: CVItem[] | ((prev: CVItem[]) => CVItem[])) => void;
  loadCVHistory: () => void;
  handleFileUpload: (file: File) => void;
  clearInput: () => void;
  handleCVUpload: (file: File) => Promise<void>;
  handleDeleteCV: (id: string) => void;
}

export const useApplyStore = create<ApplyState>((set) => ({
  inputType: 'image',
  setInputType: (inputType) => set({ inputType }),
  textInput: '',
  setTextInput: (textInput) => set({ textInput, result: null }),
  file: null,
  result: null,
  setResult: (result) => set({ result }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  editingAppId: null,
  setEditingAppId: (editingAppId) => set({ editingAppId }),
  duplicateModal: { isOpen: false, data: null },
  setDuplicateModal: (duplicateModal) => set({ duplicateModal }),
  cvHistory: [],
  selectedCV: '',
  setSelectedCV: (selectedCV) => set({ selectedCV }),
  setCvHistory: (updater) =>
    set((state) => ({
      cvHistory:
        typeof updater === 'function' ? updater(state.cvHistory) : updater,
    })),
  loadCVHistory: () => {
    const stored = localStorage.getItem('APPLYBOT_CVS');
    if (!stored) return;
    try {
      set({ cvHistory: JSON.parse(stored) });
    } catch {
      console.error('Failed to parse CV History');
    }
  },
  handleFileUpload: (file) => {
    set({ file, result: null });
  },
  clearInput: () => {
    set({
      file: null,
      textInput: '',
      result: null,
      isProcessing: false,
      editingAppId: null,
    });
  },
  handleCVUpload: async (uploadedFile) => {
    set({ isProcessing: true });
    try {
      const newCV: CVItem = {
        id: Date.now().toString(),
        name: uploadedFile.name,
        size: uploadedFile.size,
        filename: uploadedFile.name,
      };
      await setDb(`cv_blob_${newCV.id}`, uploadedFile);
      set((state) => {
        const updated = [newCV, ...state.cvHistory];
        localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updated));
        return { cvHistory: updated, selectedCV: newCV.id };
      });
      useNotificationStore
        .getState()
        .notify(
          'CV berhasil ditambahkan. AI akan mengekstraknya saat poster diunggah.',
          'success',
        );
    } catch (error: any) {
      useNotificationStore
        .getState()
        .notify('Gagal menyimpan CV: ' + error.message, 'error');
    } finally {
      set({ isProcessing: false });
    }
  },
  handleDeleteCV: (cvId) => {
    set((state) => {
      const updated = state.cvHistory.filter((cv) => cv.id !== cvId);
      localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updated));
      return {
        cvHistory: updated,
        selectedCV: state.selectedCV === cvId ? '' : state.selectedCV,
      };
    });
  },
}));

export async function performAnalysis() {
  const state = useApplyStore.getState();
  const { file, textInput, selectedCV, isProcessing, editingAppId } =
    state;
  const cvHistory = state.cvHistory;
  const { notify } = useNotificationStore.getState();
  const applications = useTrackerStore.getState().applications;

  if ((!file && !textInput.trim()) || !selectedCV || isProcessing) return;

  useApplyStore.getState().setIsProcessing(true);

  try {
    let cvItem = cvHistory.find((cv) => cv.id === selectedCV);
    let cvText = cvItem?.text;

    if (!cvText && cvItem) {
      const cvFile = await getDb(`cv_blob_${selectedCV}`);
      if (cvFile) {
        const cvFormData = new FormData();
        cvFormData.append('file', cvFile as File);
        const cvRes = await axios.post(
          `${API_BASE_URL}/api/extract-cv`,
          cvFormData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'x-api-key': localStorage.getItem('GEMINI_API_KEY'),
            },
          },
        );
        cvText = cvRes.data.text;
        useApplyStore.getState().setCvHistory((prev) =>
          prev.map((cv) =>
            cv.id === selectedCV ? { ...cv, text: cvText } : cv,
          ),
        );
      }
    }

    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else {
      formData.append('text', textInput);
    }
    formData.append('cv_text', cvText || '');

    const processRes = await axios.post(
      `${API_BASE_URL}/api/process-all`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-api-key': localStorage.getItem('GEMINI_API_KEY'),
        },
      },
    );

    const fullData = processRes.data;
    useApplyStore.getState().setResult({
      hr_email: fullData.hr_email,
      company_name: fullData.company_name,
      job_title: fullData.job_title,
      subject: fullData.subject,
      body: fullData.body,
      context_text: fullData.context_text,
      cv_text: cvText,
    });

    const isDuplicate = applications.some(
      (app: JobApplication) =>
        editingAppId !== app.id &&
        app.companyName.toLowerCase() ===
          (fullData.company_name || '').toLowerCase() &&
        app.jobTitle.toLowerCase() ===
          (fullData.job_title || '').toLowerCase(),
    );

    if (isDuplicate) {
      useApplyStore
        .getState()
        .setDuplicateModal({ isOpen: true, data: { extractedData: fullData } });
    }
  } catch (error: any) {
    notify(
      'Gagal menganalisis: ' +
        (error.response?.data?.detail || error.message),
      'error',
    );
  } finally {
    useApplyStore.getState().setIsProcessing(false);
  }
}
