import { create } from 'zustand';
import axios from 'axios';
import { get as getDb } from 'idb-keyval';
import { API_BASE_URL } from '../lib/constants';
import { useNotificationStore } from './useNotificationStore';

export interface DraftData {
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
  draft: DraftData | null;
  setDraft: (draft: DraftData | null) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  cvHistory: CVItem[];
  selectedCV: string;
  setSelectedCV: (id: string) => void;
  setCvHistory: (updater: CVItem[] | ((prev: CVItem[]) => CVItem[])) => void;
  loadCVHistory: () => void;
  handleFileUpload: (file: File) => void;
  clearInput: () => void;
}

export const useApplyStore = create<ApplyState>((set) => ({
  inputType: 'image',
  setInputType: (inputType) => set({ inputType }),
  textInput: '',
  setTextInput: (textInput) => set({ textInput, draft: null }),
  file: null,
  draft: null,
  setDraft: (draft) => set({ draft }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  editingAppId: null,
  setEditingAppId: (editingAppId) => set({ editingAppId }),
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
    set({ file, draft: null });
  },
  clearInput: () => {
    set({
      file: null,
      textInput: '',
      draft: null,
      isProcessing: false,
      editingAppId: null,
    });
  },
}));

export async function generateDraft() {
  const state = useApplyStore.getState();
  const { file, textInput, selectedCV, isProcessing } = state;
  const cvHistory = state.cvHistory;
  const { notify } = useNotificationStore.getState();

  if ((!file && !textInput.trim()) || !selectedCV || isProcessing) return;

  useApplyStore.getState().setIsProcessing(true);

  try {
    // Step 1: Extract CV text from blob if not cached
    let cvText = cvHistory.find((cv) => cv.id === selectedCV)?.text || '';
    if (!cvText) {
      const cvBlob = await getDb(`cv_blob_${selectedCV}`);
      if (cvBlob instanceof Blob) {
        const extForm = new FormData();
        extForm.append('file', cvBlob as File);
        try {
          const extRes = await axios.post(
            `${API_BASE_URL}/api/extract-cv`,
            extForm,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                'x-api-key': localStorage.getItem('GEMINI_API_KEY'),
              },
              timeout: 30000,
            },
          );
          cvText = extRes.data?.text?.trim() || '';
          if (cvText) {
            const updated = cvHistory.map((cv) =>
              cv.id === selectedCV ? { ...cv, text: cvText } : cv,
            );
            useApplyStore.getState().setCvHistory(updated);
            localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updated));
          }
        } catch {
          notify(
            'Gagal mengekstrak teks CV. Melanjutkan tanpa teks CV.',
            'warning',
          );
        }
      }
    }

    // Step 2: Generate draft
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else {
      formData.append('text', textInput);
    }
    if (cvText) {
      formData.append('cv_text', cvText);
    }

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
    useApplyStore.getState().setDraft({
      hr_email: fullData.hr_email,
      company_name: fullData.company_name,
      job_title: fullData.job_title,
      subject: fullData.subject,
      body: fullData.body,
      context_text: fullData.context_text,
      cv_text: cvText,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Gagal terhubung ke server';
    notify('Gagal menganalisis: ' + errorMessage, 'error');
  } finally {
    useApplyStore.getState().setIsProcessing(false);
  }
}
