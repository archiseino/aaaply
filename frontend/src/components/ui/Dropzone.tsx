import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface DropzoneProps {
  onUpload: (file: File) => void;
  title?: string;
  id?: string;
  notify?: (message: string, type: any) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onUpload, title = "Drag & drop poster di sini", id = "file-upload", notify }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        onUpload(file);
      } else {
        if (notify) notify("Mohon upload file gambar atau PDF.", "warning");
        else alert("Mohon upload file gambar atau PDF.");
      }
    }
  }, [onUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0]);
    }
  }, [onUpload]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300"
      style={{
        borderColor: isDragActive ? 'var(--text-primary)' : 'var(--border)',
        backgroundColor: isDragActive ? 'var(--bg-elevated)' : 'transparent',
      }}
    >
      <input 
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        id={id} 
        onChange={handleFileInput}
      />
      <label htmlFor={id} className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors"
          style={{
            backgroundColor: isDragActive ? 'var(--bg-hover)' : 'var(--bg-elevated)',
            color: isDragActive ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          <UploadCloud size={32} />
        </div>
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {isDragActive ? 'Lepaskan file di sini' : title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>atau klik untuk browse / CTRL+V untuk paste (JPG, PNG, PDF)</p>
      </label>
    </div>
  );
};

export default Dropzone;
