import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';

export function MobileHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="md:hidden h-16 flex items-center justify-between px-6 z-30 shrink-0"
      style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="SobatApply" className="h-6" style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
