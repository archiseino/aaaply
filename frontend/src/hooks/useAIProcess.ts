import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { get as getDb } from 'idb-keyval';
import { API_BASE_URL } from '../lib/constants';
import type { ToastType } from '../components/ui/Toast';
import type { CVItem } from './useCVManager';
import type { JobApplication } from '../components/tracker/Tracker';

export interface ResultData {
  hr_email?: string;
  subject?: string;
  body?: string;
  company_name?: string;
  job_title?: string;
  context_text?: string;
  cv_text?: string;
}

export function useAIProcess(deps: {
  notify: (msg: string, type?: ToastType) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  cvHistory: CVItem[];
  selectedCV: string;
  setSelectedCV: (id: string) => void;
  setCvHistory: (updater: React.SetStateAction<CVItem[]>) => void;
  applications: JobApplication[];
  editingAppId: string | null;
  setEditingAppId: (id: string | null) => void;
  onDuplicateFound: (data: any) => void;
}) {
  const [inputType, setInputType] = useState<'image' | 'text'>('image');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  const performAnalysis = useCallback(async () => {
    if ((!file && !textInput.trim()) || !deps.selectedCV || deps.isProcessing) return;

    deps.setIsProcessing(true);

    try {
      let cvItem = deps.cvHistory.find(cv => cv.id === deps.selectedCV);
      let cvText = cvItem?.text;

      if (!cvText && cvItem) {
        const cvFile = await getDb(`cv_blob_${deps.selectedCV}`);
        if (cvFile) {
          const cvFormData = new FormData();
          cvFormData.append('file', cvFile as File);
          const cvRes = await axios.post(`${API_BASE_URL}/api/extract-cv`, cvFormData, {
            headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': localStorage.getItem('GEMINI_API_KEY') },
          });
          cvText = cvRes.data.text;

          deps.setCvHistory(prev =>
            prev.map(cv =>
              cv.id === deps.selectedCV ? { ...cv, text: cvText } : cv
            )
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

      const processRes = await axios.post(`${API_BASE_URL}/api/process-all`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'x-api-key': localStorage.getItem('GEMINI_API_KEY') },
      });

      const fullData = processRes.data;

      setResult({
        hr_email: fullData.hr_email,
        company_name: fullData.company_name,
        job_title: fullData.job_title,
        subject: fullData.subject,
        body: fullData.body,
        context_text: fullData.context_text,
        cv_text: cvText,
      });

      const isDuplicate = deps.applications.some(app =>
        deps.editingAppId !== app.id &&
        app.companyName.toLowerCase() === (fullData.company_name || '').toLowerCase() &&
        app.jobTitle.toLowerCase() === (fullData.job_title || '').toLowerCase()
      );

      if (isDuplicate) {
        deps.onDuplicateFound({ extractedData: fullData });
      }
    } catch (error: any) {
      deps.notify(
        'Gagal menganalisis: ' + (error.response?.data?.detail || error.message),
        'error',
      );
    } finally {
      deps.setIsProcessing(false);
    }
  }, [file, textInput, deps]);

  useEffect(() => {
    if (!(file || textInput.trim()) || !deps.selectedCV || result || deps.isProcessing) return;

    performAnalysis();
  }, [file, textInput, deps.selectedCV, result, deps.isProcessing, performAnalysis]);

  const handleFileUpload = useCallback((uploadedFile: File) => {
    setFile(uploadedFile);
    setResult(null);
  }, []);

  const clearInput = useCallback(() => {
    setFile(null);
    setTextInput('');
    setResult(null);
    deps.setIsProcessing(false);
    deps.setEditingAppId(null);
  }, [deps]);

  return {
    inputType,
    setInputType,
    textInput,
    setTextInput,
    file,
    setFile,
    result,
    setResult,
    handleFileUpload,
    clearInput,
  };
}
