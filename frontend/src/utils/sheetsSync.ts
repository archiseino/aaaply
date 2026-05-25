const API_BASE = import.meta.env.VITE_API_URL || '';

export interface SheetApplication {
  row_index?: number;
  company: string;
  job_title: string;
  location?: string;
  date_applied?: string;
  method?: string;
  email?: string;
  status: string;
  notes?: string;
}

export async function syncFromSheets(sheetId: string, startCell: string = 'B7'): Promise<{ apps: SheetApplication[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/applications/sync?sheet_id=${encodeURIComponent(sheetId)}&start_cell=${encodeURIComponent(startCell)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Gagal sync dari Google Sheets');
    }
    const data = await res.json();
    return { apps: data.applications || [] };
  } catch (e: any) {
    return { apps: [], error: e.message || 'Gagal terhubung ke server' };
  }
}

export async function syncAppend(
  sheetId: string,
  startCell: string,
  app: {
    company: string;
    job_title: string;
    location?: string;
    date_applied?: string;
    method?: string;
    email?: string;
    status?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/applications/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: sheetId,
        start_cell: startCell,
        company: app.company,
        job_title: app.job_title,
        location: app.location || '',
        date_applied: app.date_applied || '',
        method: app.method || '',
        hr_email: app.email || '',
        status: app.status || 'Applied',
        notes: app.notes || '',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Gagal menyimpan ke Google Sheets');
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Gagal terhubung ke server' };
  }
}

export async function syncUpdate(
  sheetId: string,
  startCell: string,
  rowIndex: number,
  data: {
    company?: string;
    job_title?: string;
    location?: string;
    date_applied?: string;
    method?: string;
    email?: string;
    status?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/applications/sync`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: sheetId,
        start_cell: startCell,
        row_index: rowIndex,
        company: data.company,
        job_title: data.job_title,
        location: data.location,
        date_applied: data.date_applied,
        method: data.method,
        hr_email: data.email,
        status: data.status,
        notes: data.notes,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Gagal update Google Sheets');
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Gagal terhubung ke server' };
  }
}

export async function syncDelete(
  sheetId: string,
  startCell: string,
  rowIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/applications/sync`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: sheetId,
        start_cell: startCell,
        row_index: rowIndex,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Gagal hapus dari Google Sheets');
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Gagal terhubung ke server' };
  }
}
