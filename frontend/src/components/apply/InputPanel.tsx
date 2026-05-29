import { useEffect, useMemo } from 'react';
import { Sparkles, X, FileText, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import Dropzone from '../ui/Dropzone';
import { useApplyStore, generateDraft } from '../../store/useApplyStore';

export function InputPanel() {
  const inputType = useApplyStore((s) => s.inputType);
  const setInputType = useApplyStore((s) => s.setInputType);
  const file = useApplyStore((s) => s.file);
  const onFileUpload = useApplyStore((s) => s.handleFileUpload);
  const textInput = useApplyStore((s) => s.textInput);
  const setTextInput = useApplyStore((s) => s.setTextInput);
  const cvHistory = useApplyStore((s) => s.cvHistory);
  const selectedCV = useApplyStore((s) => s.selectedCV);
  const setSelectedCV = useApplyStore((s) => s.setSelectedCV);
  const isProcessing = useApplyStore((s) => s.isProcessing);
  const onClear = useApplyStore((s) => s.clearInput);

  const isImage = file?.type.startsWith('image/') ?? false;
  const fileUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return (
    <div
      className='w-full md:w-1/2 p-6 flex flex-col overflow-y-visible md:overflow-y-auto relative shrink-0 md:shrink pb-24 md:pb-6 border-b md:border-b-0 md:border-r'
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className='flex p-1 rounded-lg shrink-0 mb-6'
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <button
          onClick={() => setInputType('image')}
          className='flex-1 py-2 text-sm font-semibold rounded-md transition-colors'
          style={
            inputType === 'image'
              ? {
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }
              : { color: 'var(--text-muted)' }
          }
        >
          Upload Gambar
        </button>
        <button
          onClick={() => setInputType('text')}
          className='flex-1 py-2 text-sm font-semibold rounded-md transition-colors'
          style={
            inputType === 'text'
              ? {
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }
              : { color: 'var(--text-muted)' }
          }
        >
          Paste Teks
        </button>
      </div>

      {inputType === 'image' ? (
        <div className='flex flex-col'>
          <h2
            className='text-lg font-bold mb-2'
            style={{ color: 'var(--text-primary)' }}
          >
            Upload Poster Lowongan
          </h2>
          <p
            className='text-sm mb-6'
            style={{ color: 'var(--text-secondary)' }}
          >
            Upload poster atau screenshot loker. AI akan otomatis membaca
            informasinya.
          </p>

          {!file ? (
            <Dropzone
              onUpload={onFileUpload}
              title='Drag & drop poster di sini'
              id='poster-upload'
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className='rounded-xl overflow-hidden flex flex-col relative shrink-0'
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <button
                onClick={onClear}
                className='absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-colors z-10'
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                }}
                title='Hapus poster'
              >
                <X size={16} />
              </button>

              {isImage && fileUrl ? (
                <div
                  className='w-full h-48 flex items-center justify-center overflow-hidden relative group'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={fileUrl}
                    alt='Preview'
                    className='w-full h-full object-contain'
                  />
                </div>
              ) : (
                <div
                  className='w-full h-32 flex items-center justify-center'
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <FileText size={48} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}

              <div
                className='p-4 flex items-center gap-4 shrink-0'
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <div
                  className='w-10 h-10 rounded-lg flex items-center justify-center shrink-0'
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  {isImage ? (
                    <ImageIcon
                      size={20}
                      style={{ color: 'var(--text-secondary)' }}
                    />
                  ) : (
                    <FileText
                      size={20}
                      style={{ color: 'var(--text-secondary)' }}
                    />
                  )}
                </div>
                <div className='flex-1 overflow-hidden'>
                  <h3
                    className='font-semibold truncate'
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {file.name}
                  </h3>
                  <p
                    className='text-xs mt-0.5'
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className='flex-1 flex flex-col min-h-0 gap-6'>
          <div className='flex-1 flex flex-col min-h-0'>
            <h2
              className='text-lg font-bold mb-2'
              style={{ color: 'var(--text-primary)' }}
            >
              Paste Teks Lowongan
            </h2>
            <p
              className='text-sm mb-4'
              style={{ color: 'var(--text-secondary)' }}
            >
              Copy-paste detail lowongan dari platform manapun.
            </p>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder='Paste deskripsi pekerjaan di sini...'
              className='flex-1 w-full rounded-xl p-4 text-sm transition-all resize-none focus:outline-none focus:ring-1'
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3 mt-4 shrink-0'>
        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold' style={{ color: 'var(--text-secondary)' }}>Pilih CV</label>
          <select
            value={selectedCV}
            onChange={(e) => setSelectedCV(e.target.value)}
            className='w-full rounded-lg px-3 py-2 text-sm focus:outline-none'
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value=''>-- Pilih CV --</option>
            {cvHistory.map((cv) => (
              <option key={cv.id} value={cv.id}>{cv.name}</option>
            ))}
          </select>
          {cvHistory.length === 0 && (
            <p className='text-xs' style={{ color: 'var(--status-yellow)' }}>Upload CV dulu di menu Settings.</p>
          )}
        </div>

        <button
          onClick={generateDraft}
          disabled={!(file || textInput.trim()) || !selectedCV || isProcessing}
          className='w-full font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50'
          style={{
            backgroundColor: 'var(--text-primary)',
            color: 'var(--text-inverse)',
          }}
        >
          {isProcessing ? (
            <div className='w-4 h-4 border-2 border-t-transparent rounded-full animate-spin' style={{ borderColor: 'var(--text-inverse)', borderTopColor: 'transparent' }} />
          ) : (
            <Sparkles size={16} />
          )}
          {isProcessing ? 'Memproses...' : 'Generate Draft'}
        </button>
      </div>
    </div>
  );
}
