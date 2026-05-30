import { useEffect } from 'react';
import { X, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAppStore } from './store/useAppStore';
import { useNotificationStore } from './store/useNotificationStore';
import { useApplyStore } from './store/useApplyStore';
import { useTrackerStore } from './store/useTrackerStore';

import { MobileHeader } from './components/layout/MobileHeader';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ApplyPage } from './pages/ApplyPage';
import { JobFinderPage } from './pages/JobFinderPage';
import { TrackerPage } from './pages/TrackerPage';
import SettingsModal from './components/settings/SettingsModal';
import Toast from './components/ui/Toast';

function App() {
  const activeTab = useAppStore((s) => s.activeTab);

  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const infoModal = useAppStore((s) => s.infoModal);
  const setInfoModal = useAppStore((s) => s.setInfoModal);
  const setSheetId = useAppStore((s) => s.setSheetId);

  const notifications = useNotificationStore((s) => s.notifications);
  const notify = useNotificationStore((s) => s.notify);
  const removeNotification = useNotificationStore((s) => s.removeNotification);

  const loadCVHistory = useApplyStore((s) => s.loadCVHistory);
  const loadFromLocalStorage = useTrackerStore((s) => s.loadFromLocalStorage);

  useEffect(() => {
    loadFromLocalStorage();
    loadCVHistory();
    const sid = localStorage.getItem('SOBAT_SHEET_ID');
    if (sid) {
      setSheetId(sid);
      const sc = localStorage.getItem('SOBAT_START_CELL') || 'B7';
      import('./utils/sheetsSync').then(({ syncFromSheets }) => {
        syncFromSheets(sid, sc).then(({ apps, error }) => {
          if (error || apps.length === 0) return;
          import('./lib/sheet').then(({ mapSheetToApplications }) => {
            useTrackerStore
              .getState()
              .setApplications(mapSheetToApplications(apps));
          });
        });
      });
    }
  }, [loadCVHistory, loadFromLocalStorage, setSheetId]);

  useEffect(() => {
    const unsub = useTrackerStore.subscribe(({ applications }) => {
      localStorage.setItem('APPLYBOT_TRACKER', JSON.stringify(applications));
    });
    return unsub;
  }, []);

  return (
    <div
      className='h-screen w-screen flex flex-col md:flex-row font-sans overflow-hidden'
      style={{
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-primary)',
      }}
    >
      <MobileHeader />

      <Sidebar />

      <MobileBottomNav />

      <style>{`
        @media (max-width: 768px) {
          main { padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      <main
        className='flex-1 flex flex-col overflow-hidden relative'
        style={{ backgroundColor: 'var(--bg-main)' }}
      >
        <AnimatePresence mode='wait'>
          {activeTab === 'apply' && <ApplyPage />}
          {activeTab === 'jobfinder' && <JobFinderPage />}
          {activeTab === 'tracker' && <TrackerPage />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            onClose={() => {
              useAppStore.getState().setIsSettingsOpen(false);
              loadCVHistory();
              const sid = localStorage.getItem('SOBAT_SHEET_ID') || '';
              setSheetId(sid);
            }}
            notify={notify}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {infoModal.isOpen && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className='w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-8 relative'
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <button
                onClick={() => setInfoModal({ isOpen: false, type: null })}
                className='absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors'
              >
                <X size={20} />
              </button>
              {infoModal.type === 'about' ? (
                <div className='prose prose-invert max-w-none'>
                  <h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
                    <Sparkles className='text-blue-500' /> About SobatApply
                  </h2>
                  <p>
                    SobatApply adalah asisten cerdas berbasis Artificial
                    Intelligence (AI) yang dirancang khusus untuk membantu para
                    pencari kerja di Indonesia dalam menyusun strategi lamaran
                    kerja yang lebih efektif dan profesional.
                  </p>
                  <h3 className='text-lg font-bold mt-6 mb-2'>Visi Kami</h3>
                  <p>
                    Membantu jutaan talenta Indonesia mendapatkan pekerjaan
                    impian mereka dengan bantuan teknologi AI yang etis dan
                    mudah diakses.
                  </p>
                </div>
              ) : (
                <div className='prose prose-invert max-w-none'>
                  <h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
                    <Settings className='text-blue-500' /> Privacy Policy
                  </h2>
                  <p
                    className='text-sm italic mb-4'
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Terakhir diperbarui: 13 Mei 2026
                  </p>
                  <h3 className='text-lg font-bold mt-6 mb-2'>
                    1. Pengolahan Data CV
                  </h3>
                  <p className='mb-4 text-sm leading-relaxed'>
                    SobatApply sangat menghargai privasi Anda. File CV yang Anda
                    unggah diproses melalui memori lokal (IndexedDB) di browser
                    Anda. Kami hanya mengirimkan konten teks dari CV Anda ke
                    server Google Gemini untuk keperluan ekstraksi data dan
                    pembuatan draf email.
                  </p>
                  <h3 className='text-lg font-bold mt-6 mb-2'>
                    2. Keamanan Data
                  </h3>
                  <p className='mb-4 text-sm leading-relaxed'>
                    Kami tidak menyimpan salinan file CV Anda di database kami
                    secara permanen. Data CV Anda hanya ada selama sesi
                    penggunaan aplikasi dan akan tetap berada di perangkat Anda
                    kecuali Anda menghapusnya secara manual melalui menu
                    Settings.
                  </p>
                  <h3 className='text-lg font-bold mt-6 mb-2'>
                    3. Layanan Pihak Ketiga
                  </h3>
                  <p className='mb-4 text-sm leading-relaxed'>
                    Aplikasi ini menggunakan API Google Gemini untuk pemrosesan
                    AI. Penggunaan data oleh Google tunduk pada Kebijakan
                    Privasi Google. Kami tidak menjual data pribadi Anda kepada
                    pihak ketiga manapun.
                  </p>
                  <h3 className='text-lg font-bold mt-6 mb-2'>
                    4. Persetujuan
                  </h3>
                  <p className='mb-4 text-sm leading-relaxed'>
                    Dengan menggunakan SobatApply, Anda setuju dengan pengolahan
                    data sebagaimana dijelaskan dalam kebijakan ini untuk tujuan
                    mempersonalisasi lamaran kerja Anda.
                  </p>
                </div>
              )}
              <div
                className='mt-8 pt-6 border-t flex justify-end'
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => setInfoModal({ isOpen: false, type: null })}
                  className='px-6 py-2 rounded-lg font-bold transition-all'
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--text-inverse)',
                  }}
                >
                  Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none'>
        <AnimatePresence>
          {notifications.map((n) => (
            <div key={n.id} className='pointer-events-auto'>
              <Toast
                id={n.id}
                type={n.type}
                message={n.message}
                onClose={removeNotification}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
