import { motion } from 'framer-motion';
import { InputPanel } from '../components/apply/InputPanel';
import { CVPanel } from '../components/apply/CVPanel';
import { ProcessingOverlay } from '../components/apply/ProcessingOverlay';
import type { ResultData } from '../hooks/useAIProcess';
import type { CVItem } from '../hooks/useCVManager';
import type { ToastType } from '../components/ui/Toast';

interface ApplyPageProps {
  isProcessing: boolean;
  inputType: 'image' | 'text';
  onInputTypeChange: (type: 'image' | 'text') => void;
  file: File | null;
  onFileUpload: (file: File) => void;
  textInput: string;
  onTextInputChange: (text: string) => void;
  onClear: () => void;
  fileUrl: string | null;
  isImage: boolean;
  result: ResultData | null;
  cvHistory: CVItem[];
  selectedCV: string;
  onCVChange: (id: string) => void;
  onCVUpload: (file: File) => void;
  onSend: (method: 'outlook' | 'gmail' | 'native') => void;
  onCopyFileCV: () => Promise<boolean>;
  onChange: (data: ResultData) => void;
  notify: (msg: string, type?: ToastType) => void;
}

export function ApplyPage({
  isProcessing,
  inputType,
  onInputTypeChange,
  file,
  onFileUpload,
  textInput,
  onTextInputChange,
  onClear,
  fileUrl,
  isImage,
  result,
  cvHistory,
  selectedCV,
  onCVChange,
  onCVUpload,
  onSend,
  onCopyFileCV,
  onChange,
  notify,
}: ApplyPageProps) {
  return (
    <motion.div
      key='apply'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className='flex-1 flex flex-col md:flex-row w-full h-full overflow-y-auto md:overflow-hidden relative'
    >
      {isProcessing && <ProcessingOverlay />}

      <InputPanel
        inputType={inputType}
        onInputTypeChange={onInputTypeChange}
        file={file}
        onFileUpload={onFileUpload}
        textInput={textInput}
        onTextInputChange={onTextInputChange}
        onClear={onClear}
        fileUrl={fileUrl}
        isImage={isImage}
      />

      <CVPanel
        result={result}
        cvHistory={cvHistory}
        selectedCV={selectedCV}
        onCVChange={onCVChange}
        onCVUpload={onCVUpload}
        onSend={onSend}
        onCopyFileCV={onCopyFileCV}
        onChange={onChange}
        notify={notify}
        file={file}
        textInput={textInput}
      />
    </motion.div>
  );
}
