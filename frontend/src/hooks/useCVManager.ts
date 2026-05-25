import { useState, useCallback } from 'react';
import { set as setDb } from 'idb-keyval';
import type { ToastType } from '../components/ui/Toast';

export interface CVItem {
  id: string;
  name: string;
  size: number;
  text?: string;
  filename?: string;
}

export function useCVManager(deps: {
  notify: (msg: string, type?: ToastType) => void;
  setIsProcessing: (v: boolean) => void;
}) {
  const [cvHistory, setCvHistory] = useState<CVItem[]>([]);
  const [selectedCV, setSelectedCV] = useState('');

  const loadCVHistory = useCallback(() => {
    const stored = localStorage.getItem('APPLYBOT_CVS');
    if (!stored) return;
    try {
      setCvHistory(JSON.parse(stored));
    } catch {
      console.error('Failed to parse CV History');
    }
  }, []);

  const handleCVUpload = useCallback(async (uploadedFile: File) => {
    deps.setIsProcessing(true);
    try {
      const newCV: CVItem = {
        id: Date.now().toString(),
        name: uploadedFile.name,
        size: uploadedFile.size,
        filename: uploadedFile.name,
      };

      await setDb(`cv_blob_${newCV.id}`, uploadedFile);

      setCvHistory(prev => {
        const updated = [newCV, ...prev];
        localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updated));
        return updated;
      });
      setSelectedCV(newCV.id);
      deps.notify('CV berhasil ditambahkan. AI akan mengekstraknya saat poster diunggah.', 'success');
    } catch (error: any) {
      deps.notify('Gagal menyimpan CV: ' + error.message, 'error');
    } finally {
      deps.setIsProcessing(false);
    }
  }, [deps]);

  const handleDeleteCV = useCallback((cvId: string) => {
    setCvHistory(prev => {
      const updated = prev.filter(cv => cv.id !== cvId);
      localStorage.setItem('APPLYBOT_CVS', JSON.stringify(updated));
      return updated;
    });
    setSelectedCV(prev => prev === cvId ? '' : prev);
  }, []);

  return {
    cvHistory,
    selectedCV,
    setSelectedCV,
    setCvHistory,
    loadCVHistory,
    handleCVUpload,
    handleDeleteCV,
  };
}
