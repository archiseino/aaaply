import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
}

const Toast = ({ id, type, message, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertTriangle size={18} />,
  };

  const accentColors: Record<ToastType, string> = {
    success: 'var(--status-green)',
    error: 'var(--status-red)',
    info: 'var(--status-blue)',
    warning: 'var(--status-yellow)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } }}
      layout
      className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl min-w-[280px] max-w-[420px] relative overflow-hidden backdrop-blur-xl"
      style={{ 
        backgroundColor: 'color-mix(in srgb, var(--bg-card) 85%, transparent)',
        border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
      }}
    >
      <div className="shrink-0" style={{ color: accentColors[type] }}>
        {icons[type]}
      </div>
      <div className="flex-1 text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="shrink-0 p-1 rounded-lg transition-colors opacity-40 hover:opacity-100"
        style={{ color: 'var(--text-muted)' }}
      >
        <X size={14} />
      </button>
      
      {/* Progress bar */}
      <motion.div 
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 4, ease: 'linear' }}
        className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
        style={{ backgroundColor: accentColors[type], opacity: 0.5 }}
      />
    </motion.div>
  );
};

export default Toast;
