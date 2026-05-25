import { useState, useEffect, useCallback } from 'react';
import type { ToastType } from '../components/ui/Toast';
import type { JobApplication } from '../components/tracker/Tracker';
import {
  getSheetCfg,
  mapSheetToApplications,
  syncJobAppAndReload,
} from '../lib/sheet';
import {
  syncFromSheets,
  syncUpdate,
  syncDelete,
} from '../utils/sheetsSync';

export function useTracker(deps: { notify: (msg: string, type?: ToastType) => void }) {
  const [applications, setApplications] = useState<JobApplication[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('APPLYBOT_TRACKER');
    if (saved) {
      try {
        setApplications(JSON.parse(saved));
      } catch {
        console.error('Failed to parse tracker data');
      }
    }

    const sid = localStorage.getItem('SOBAT_SHEET_ID');
    if (sid) {
      const sc = localStorage.getItem('SOBAT_START_CELL') || 'B7';
      syncFromSheets(sid, sc).then(({ apps, error }) => {
        if (error || apps.length === 0) return;
        setApplications(mapSheetToApplications(apps));
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('APPLYBOT_TRACKER', JSON.stringify(applications));
  }, [applications]);

  const handleUpdateStatus = useCallback(
    async (id: string, newStatus: JobApplication['status']) => {
      const prev = applications.find(a => a.id === id);
      const prevStatus = prev?.status;

      setApplications(prevApps =>
        prevApps.map(app =>
          app.id === id ? { ...app, status: newStatus } : app,
        ),
      );

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
            setApplications(p =>
              p.map(app =>
                app.id === id
                  ? { ...app, status: prevStatus || 'Applied' }
                  : app,
              ),
            );
            deps.notify('Gagal sync ke Google Sheets: ' + (error || 'Unknown'), 'error');
          } else {
            deps.notify('Status tersimpan ke Google Sheets ✅', 'success');
          }
        }
      }
    },
    [applications, deps.notify],
  );

  const handleDeleteApplication = useCallback(
    async (id: string) => {
      const deleted = applications.find(a => a.id === id);
      setApplications(prev => prev.filter(app => app.id !== id));

      if (deleted?.sheetRowIndex) {
        const cfg = getSheetCfg();
        if (cfg.sheetId) {
          const { success, error } = await syncDelete(
            cfg.sheetId,
            cfg.startCell,
            deleted.sheetRowIndex,
          );
          if (!success) {
            setApplications(prev => [deleted, ...prev]);
            deps.notify('Gagal hapus dari Google Sheets: ' + (error || 'Unknown'), 'error');
          } else {
            deps.notify('Dihapus dari Google Sheets ✅', 'success');
          }
        }
      }
    },
    [applications, deps.notify],
  );

  const handleEditSave = useCallback(
    async (app: JobApplication) => {
      setApplications(prev => prev.map(a => (a.id === app.id ? app : a)));

      if (app.sheetRowIndex) {
        const cfg = getSheetCfg();
        if (cfg.sheetId) {
          const { success } = await syncUpdate(cfg.sheetId, cfg.startCell, app.sheetRowIndex, {
            company: app.companyName,
            job_title: app.jobTitle,
            location: app.location,
            date_applied: app.dateApplied,
            method: app.method,
            email: app.hrEmail,
            status: app.status,
            notes: app.notes,
          });
          if (success) {
            deps.notify('Perubahan tersimpan ke Google Sheets ✅', 'success');
          } else {
            deps.notify('Gagal sync ke Google Sheets', 'error');
          }
        }
      } else {
        deps.notify('Lamaran lokal diperbarui', 'success');
      }
    },
    [deps.notify],
  );

  const handleAddManualApplication = useCallback(
    async (newApp: JobApplication) => {
      setApplications(prev => [newApp, ...prev]);
      deps.notify('Lamaran manual berhasil ditambahkan!', 'success');
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
      if (reloaded) setApplications(reloaded);
    },
    [deps.notify],
  );

  const handleSyncFromSheets = useCallback(async (): Promise<any[]> => {
    const cfg = getSheetCfg();
    if (!cfg.sheetId) {
      deps.notify('Sheet ID belum dikonfigurasi. Isi di Pengaturan.', 'warning');
      return [];
    }
    const { apps, error } = await syncFromSheets(cfg.sheetId, cfg.startCell);
    if (error) {
      deps.notify('Sync error: ' + error, 'error');
      return [];
    }
    const mapped = mapSheetToApplications(apps);
    setApplications(mapped);
    deps.notify(`${apps.length} aplikasi dimuat dari Google Sheets`, 'success');
    return apps;
  }, [deps.notify]);

  return {
    applications,
    setApplications,
    handleUpdateStatus,
    handleDeleteApplication,
    handleEditSave,
    handleAddManualApplication,
    handleSyncFromSheets,
  };
}
