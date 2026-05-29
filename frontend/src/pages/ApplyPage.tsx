import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { InputPanel } from '../components/apply/InputPanel';
import DraftPanel from '../components/apply/DraftPanel';
import { useApplyStore } from '../store/useApplyStore';

export function ApplyPage() {
  const handleFileUpload = useApplyStore((s) => s.handleFileUpload);

  useEffect(() => {
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
  }, [handleFileUpload]);

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
      <DraftPanel />
    </motion.div>
  );
}
