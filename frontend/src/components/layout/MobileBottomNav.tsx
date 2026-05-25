import { Settings, Send as SendIcon, LayoutDashboard, Briefcase } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'apply' | 'tracker' | 'jobfinder';
  onTabChange: (tab: 'apply' | 'tracker' | 'jobfinder') => void;
  onOpenSettings: () => void;
}

export function MobileBottomNav({ activeTab, onTabChange, onOpenSettings }: MobileBottomNavProps) {
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-6 pt-2 backdrop-blur-xl border-t"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
        borderColor: 'var(--border)',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        height: 'auto',
      }}
    >
      <button
        onClick={() => onTabChange('apply')}
        className="flex flex-col items-center gap-1 transition-all"
        style={{ color: activeTab === 'apply' ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        <SendIcon size={20} className={activeTab === 'apply' ? 'scale-110' : ''} />
        <span className="text-[10px] font-bold">Lamaran</span>
      </button>

      <button
        onClick={() => onTabChange('jobfinder')}
        className="flex flex-col items-center gap-1 transition-all"
        style={{ color: activeTab === 'jobfinder' ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        <Briefcase size={20} className={activeTab === 'jobfinder' ? 'scale-110' : ''} />
        <span className="text-[10px] font-bold">Lowongan</span>
      </button>

      <button
        onClick={() => onTabChange('tracker')}
        className="flex flex-col items-center gap-1 transition-all"
        style={{ color: activeTab === 'tracker' ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        <LayoutDashboard size={20} className={activeTab === 'tracker' ? 'scale-110' : ''} />
        <span className="text-[10px] font-bold">Riwayat</span>
      </button>

      <button
        onClick={onOpenSettings}
        className="flex flex-col items-center gap-1 transition-all"
        style={{ color: 'var(--text-muted)' }}
      >
        <Settings size={20} />
        <span className="text-[10px] font-bold">Pengaturan</span>
      </button>
    </div>
  );
}
