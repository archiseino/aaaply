import { create } from 'zustand';

interface AppState {
  activeTab: 'apply' | 'tracker' | 'jobfinder';
  setActiveTab: (tab: 'apply' | 'tracker' | 'jobfinder') => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  infoModal: { isOpen: boolean; type: 'about' | 'privacy' | null };
  setInfoModal: (modal: {
    isOpen: boolean;
    type: 'about' | 'privacy' | null;
  }) => void;
  sheetId: string;
  setSheetId: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'apply',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  isSettingsOpen: false,
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  infoModal: { isOpen: false, type: null },
  setInfoModal: (modal) => set({ infoModal: modal }),
  sheetId: '',
  setSheetId: (id) => set({ sheetId: id }),
}));
