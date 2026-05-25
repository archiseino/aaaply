import React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApplicationSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const ApplicationSearch: React.FC<ApplicationSearchProps> = ({ value, onChange, placeholder = "Cari posisi, perusahaan, atau email..." }) => {
  return (
    <div className="relative group w-full sm:max-w-md">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-400" style={{ color: 'var(--text-muted)' }}>
        <Search size={18} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-3 flex items-center hover:text-rose-400 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </motion.button>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-focus-within:opacity-100" 
           style={{ border: '1px solid color-mix(in srgb, var(--status-blue) 40%, transparent)', boxShadow: '0 0 10px color-mix(in srgb, var(--status-blue) 10%, transparent)' }} />
    </div>
  );
};

export default ApplicationSearch;
