import {
  syncAppend,
  syncFromSheets,
  type SheetApplication,
} from '../utils/sheetsSync';
import type { JobApplication } from '../components/tracker/Tracker';

interface SyncFields {
  company: string;
  job_title: string;
  location?: string;
  date_applied: string;
  method?: string;
  email?: string;
  status: string;
  notes?: string;
}

export function getSheetCfg(): { sheetId: string; startCell: string } {
  return {
    sheetId: localStorage.getItem('SOBAT_SHEET_ID') || '',
    startCell: localStorage.getItem('SOBAT_START_CELL') || 'B7',
  };
}

export function mapSheetToApplications(
  apps: SheetApplication[]
): JobApplication[] {
  if (!apps.length) return [];
  const now = new Date().toISOString();
  return apps.map((s, idx) => ({
    id: `sheet-${s.row_index || idx}-${Date.now()}`,
    companyName: s.company,
    jobTitle: s.job_title,
    hrEmail: s.email || '',
    location: s.location || '',
    method: s.method || '',
    notes: s.notes || '',
    dateApplied: s.date_applied || now,
    status: (s.status as JobApplication['status']) || 'Applied',
    sheetRowIndex: s.row_index,
  }));
}

export async function syncJobAppAndReload(
  fields: SyncFields
): Promise<JobApplication[] | null> {
  const cfg = getSheetCfg();
  if (!cfg.sheetId) return null;
  const { success } = await syncAppend(cfg.sheetId, cfg.startCell, {
    company: fields.company,
    job_title: fields.job_title,
    location: fields.location || '',
    date_applied: fields.date_applied,
    method: fields.method || '',
    email: fields.email && fields.email !== '-' ? fields.email : '',
    status: fields.status,
    notes: fields.notes || '',
  });
  if (!success) return null;
  const { apps } = await syncFromSheets(cfg.sheetId, cfg.startCell);
  return mapSheetToApplications(apps);
}

export async function syncAppAndReload(appData: {
  company_name?: string;
  job_title?: string;
  hr_email?: string;
}): Promise<JobApplication[] | null> {
  return syncJobAppAndReload({
    company: appData.company_name || '',
    job_title: appData.job_title || '',
    date_applied: new Date().toISOString(),
    email: appData.hr_email,
    status: 'Applied',
  });
}
