import { create } from 'zustand';
import type { JobApplication } from '../components/tracker/Tracker';
import {
  getSheetCfg,
  mapSheetToApplications,
  syncJobAppAndReload,
} from '../lib/sheet';
import { syncFromSheets, syncUpdate, syncDelete } from '../utils/sheetsSync';
import { useNotificationStore } from './useNotificationStore';

interface TrackerState {
  applications: JobApplication[];
  setApplications: (
    updater: JobApplication[] | ((prev: JobApplication[]) => JobApplication[]),
  ) => void;
  handleUpdateStatus: (
    id: string,
    newStatus: JobApplication['status'],
  ) => Promise<void>;
  handleDeleteApplication: (id: string) => Promise<void>;
  handleEditSave: (app: JobApplication) => Promise<void>;
  handleAddManualApplication: (newApp: JobApplication) => Promise<void>;
  handleSyncFromSheets: () => Promise<void>;
  loadFromLocalStorage: () => void;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  applications: [],
  setApplications: (updater) => {
    set((state) => ({
      applications:
        typeof updater === 'function' ? updater(state.applications) : updater,
    }));
  },

  handleUpdateStatus: async (id, newStatus) => {
    const { applications } = get();
    const notify = useNotificationStore.getState().notify;
    const prev = applications.find((a) => a.id === id);
    const prevStatus = prev?.status;

    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === id ? { ...app, status: newStatus } : app,
      ),
    }));

    if (prev?.sheetRowIndex) {
      const cfg = getSheetCfg();
      if (cfg.sheetId) {
        const { success, error } = await syncUpdate(
          cfg.sheetId,
          cfg.startCell,
          prev.sheetRowIndex,
          { status: newStatus },
        );
        if (!success) {
          set((state) => ({
            applications: state.applications.map((app) =>
              app.id === id ? { ...app, status: prevStatus || 'Applied' } : app,
            ),
          }));
          notify(
            'Gagal sync ke Google Sheets: ' + (error || 'Unknown'),
            'error',
          );
        } else {
          notify('Status tersimpan ke Google Sheets ✅', 'success');
        }
      }
    }
  },

  handleDeleteApplication: async (id) => {
    const { applications } = get();
    const notify = useNotificationStore.getState().notify;
    const deleted = applications.find((a) => a.id === id);
    set((state) => ({
      applications: state.applications.filter((app) => app.id !== id),
    }));

    if (deleted?.sheetRowIndex) {
      const cfg = getSheetCfg();
      if (cfg.sheetId) {
        const { success, error } = await syncDelete(
          cfg.sheetId,
          cfg.startCell,
          deleted.sheetRowIndex,
        );
        if (!success) {
          set((state) => ({
            applications: [...state.applications, deleted],
          }));
          notify(
            'Gagal hapus dari Google Sheets: ' + (error || 'Unknown'),
            'error',
          );
        } else {
          notify('Dihapus dari Google Sheets ✅', 'success');
        }
      }
    }
  },

  handleEditSave: async (app) => {
    const notify = useNotificationStore.getState().notify;
    set((state) => ({
      applications: state.applications.map((a) => (a.id === app.id ? app : a)),
    }));

    if (app.sheetRowIndex) {
      const cfg = getSheetCfg();
      if (cfg.sheetId) {
        const { success } = await syncUpdate(
          cfg.sheetId,
          cfg.startCell,
          app.sheetRowIndex,
          {
            company: app.companyName,
            job_title: app.jobTitle,
            location: app.location,
            date_applied: app.dateApplied,
            method: app.method,
            email: app.hrEmail,
            status: app.status,
            notes: app.notes,
          },
        );
        if (success) {
          notify('Perubahan tersimpan ke Google Sheets ✅', 'success');
        } else {
          notify('Gagal sync ke Google Sheets', 'error');
        }
      }
    } else {
      notify('Lamaran lokal diperbarui', 'success');
    }
  },

  handleAddManualApplication: async (newApp) => {
    const notify = useNotificationStore.getState().notify;
    set((state) => ({
      applications: [newApp, ...state.applications],
    }));
    notify('Lamaran manual berhasil ditambahkan!', 'success');
    const reloaded = await syncJobAppAndReload({
      company: newApp.companyName,
      job_title: newApp.jobTitle,
      location: newApp.location,
      date_applied: newApp.dateApplied,
      method: newApp.method,
      email: newApp.hrEmail,
      status: newApp.status,
      notes: newApp.notes,
    });
    if (reloaded) set({ applications: reloaded });
  },

  handleSyncFromSheets: async () => {
    const notify = useNotificationStore.getState().notify;
    const cfg = getSheetCfg();
    if (!cfg.sheetId) {
      notify('Sheet ID belum dikonfigurasi. Isi di Pengaturan.', 'warning');
    }
    const { apps, error } = await syncFromSheets(cfg.sheetId, cfg.startCell);
    if (error) {
      notify('Sync error: ' + error, 'error');
    }
    const mapped = mapSheetToApplications(apps);
    set({ applications: mapped });
    notify(`${apps.length} aplikasi dimuat dari Google Sheets`, 'success');
  },

  loadFromLocalStorage: () => {
    const saved = localStorage.getItem('APPLYBOT_TRACKER');
    if (saved) {
      try {
        set({ applications: JSON.parse(saved) });
      } catch {
        console.error('Failed to parse tracker data');
      }
    }
  },
}));
