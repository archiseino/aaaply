import { Settings, Sun, Moon, Send as SendIcon, LayoutDashboard, Briefcase } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';
import { useAppStore } from '../../store/useAppStore';
import { useTrackerStore } from '../../store/useTrackerStore';

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const setIsMobileMenuOpen = useAppStore((s) => s.setIsMobileMenuOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setIsSettingsOpen);
  const setInfoModal = useAppStore((s) => s.setInfoModal);

  const applicationsCount = useTrackerStore((s) => s.applications.length);

  const handleClose = () => setIsMobileMenuOpen(false);

  return (
    <aside
      className={`
        fixed inset-0 md:relative md:flex w-64 flex-col z-40 shrink-0 transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      style={{ backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}
    >
      <div className="h-16 hidden md:flex items-center px-6 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <img src="/logo.png" alt="SobatApply" className="h-5" style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }} />
        <span className="ml-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>by Doni</span>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
        <button
          onClick={() => { setActiveTab('apply'); handleClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
          style={activeTab === 'apply' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
        >
          <SendIcon size={18} /> Lamaran Baru
        </button>
        <button
          onClick={() => { setActiveTab('tracker'); handleClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
          style={activeTab === 'tracker' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
        >
          <LayoutDashboard size={18} /> Riwayat Lamaran
          {applicationsCount > 0 && (
            <span className="ml-auto text-xs py-0.5 px-2 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              {applicationsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('jobfinder'); handleClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
          style={activeTab === 'jobfinder' ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
        >
          <Briefcase size={18} /> Cari Lowongan
        </button>
      </nav>

      <div className="p-4 shrink-0 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleTheme}
          className="w-full hidden md:flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        </button>
        <button
          onClick={() => { setIsSettingsOpen(true); handleClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings size={18} /> Pengaturan
        </button>

        <div className="mt-2 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setInfoModal({ isOpen: true, type: 'about' })}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-colors opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Tentang Kami
          </button>
          <button
            onClick={() => setInfoModal({ isOpen: true, type: 'privacy' })}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-colors opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Kebijakan Privasi
          </button>
        </div>
      </div>
    </aside>
  );
}
