import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { InputPanel } from '../components/apply/InputPanel';
import ResultForm from '../components/apply/ResultForm';
import { useApplyStore, performAnalysis } from '../store/useApplyStore';

export function ApplyPage() {
  const file = useApplyStore((s) => s.file);
  const textInput = useApplyStore((s) => s.textInput);
  const selectedCV = useApplyStore((s) => s.selectedCV);
  const result = useApplyStore((s) => s.result);
  const isProcessing = useApplyStore((s) => s.isProcessing);
  const handleFileUpload = useApplyStore((s) => s.handleFileUpload);

  useEffect(() => {
    if (!(file || textInput.trim()) || !selectedCV || result || isProcessing) {
      return;
    }
    performAnalysis();
  }, [file, textInput, selectedCV, result, isProcessing]);

  useEffect(() => {
    if (result) return;
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
  }, [result, handleFileUpload]);

  return (
    <motion.div
      key='apply'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className='flex-1 flex flex-col md:flex-row w-full h-full overflow-y-auto md:overflow-hidden relative'
    >
      <InputPanel />
      <ResultForm />
    </motion.div>
  );
}
