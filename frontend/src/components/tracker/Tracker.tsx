import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  HelpCircle,
  Trash2,
  Edit2,
  Send,
  SearchX,
  Plus,
  X,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
} from 'recharts';

import { ConfirmModal } from '../ui/ConfirmModal';
import ApplicationSearch from './ApplicationSearch';
import StatusFilter from './StatusFilter';

export interface JobApplication {
  id: string;
  companyName: string;
  jobTitle: string;
  hrEmail: string;
  dateApplied: string;
  status: 'Applied' | 'No Response' | 'Interviewing' | 'Approve' | 'Decline';
  subject?: string;
  body?: string;
  contextText?: string;
  location?: string;
  method?: string;
  notes?: string;
  sheetRowIndex?: number;
}

interface TrackerProps {
  applications: JobApplication[];
  onUpdateStatus: (id: string, newStatus: JobApplication['status']) => void;
  onDelete: (id: string) => void;
  onEdit: (app: JobApplication) => void;
  onEditSave?: (app: JobApplication) => void;
  onAdd?: (app: JobApplication) => void;
  sheetId?: string;
  onSyncFromSheets?: () => Promise<any>;
}

const statusStyles: Record<string, React.CSSProperties> = {
  Applied: {
    backgroundColor: 'color-mix(in srgb, var(--status-blue) 15%, transparent)',
    color: 'var(--status-blue)',
    border: '1px solid color-mix(in srgb, var(--status-blue) 25%, transparent)',
  },
  'No Response': {
    backgroundColor: 'color-mix(in srgb, var(--status-gray) 15%, transparent)',
    color: 'var(--status-gray)',
    border: '1px solid color-mix(in srgb, var(--status-gray) 25%, transparent)',
  },
  Interviewing: {
    backgroundColor:
      'color-mix(in srgb, var(--status-yellow) 15%, transparent)',
    color: 'var(--status-yellow)',
    border:
      '1px solid color-mix(in srgb, var(--status-yellow) 25%, transparent)',
  },
  Decline: {
    backgroundColor: 'color-mix(in srgb, var(--status-red) 15%, transparent)',
    color: 'var(--status-red)',
    border: '1px solid color-mix(in srgb, var(--status-red) 25%, transparent)',
  },
  Approve: {
    backgroundColor: 'color-mix(in srgb, var(--status-green) 15%, transparent)',
    color: 'var(--status-green)',
    border:
      '1px solid color-mix(in srgb, var(--status-green) 25%, transparent)',
  },
};

const CHART_COLORS: Record<string, string> = {
  Applied: '#6b8aaf',
  'No Response': '#7a7a7a',
  Interviewing: '#b8a44e',
  Decline: '#b05a5a',
  Approve: '#5a9e6f',
};

const statusIcons: Record<string, React.ReactNode> = {
  Applied: <Clock size={14} />,
  'No Response': <HelpCircle size={14} />,
  Interviewing: <Users size={14} />,
  Decline: <XCircle size={14} />,
  Approve: <CheckCircle2 size={14} />,
};

function safeFormatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const parts = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (parts) {
    const idMonths: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      mei: '05',
      jun: '06',
      jul: '07',
      agu: '08',
      sep: '09',
      okt: '10',
      nov: '11',
      des: '12',
    };
    const m = idMonths[parts[2].toLowerCase()];
    if (m) {
      const iso = `${parts[3]}-${m}-${parseInt(parts[1]).toString().padStart(2, '0')}`;
      const d2 = new Date(iso);
      if (!isNaN(d2.getTime())) {
        return d2.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }
  }
  return dateStr;
}

const NotesRow: React.FC<{
  app: JobApplication;
  onSave: (app: JobApplication, notes: string) => void;
  variant?: 'desktop' | 'mobile';
}> = ({ app, onSave, variant = 'desktop' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const toggle = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    setDraft(app.notes || '');
  };

  const save = () => {
    onSave(app, draft);
    setIsOpen(false);
  };

  if (variant === 'mobile') {
    return (
      <div className='flex flex-col gap-1.5 px-1'>
        <span
          className='text-[11px] font-semibold uppercase tracking-wider'
          style={{ color: 'var(--text-muted)' }}
        >
          Catatan
        </span>
        <div
          className='rounded-xl overflow-hidden'
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <button
            type='button'
            onClick={toggle}
            className='w-full flex items-center justify-between gap-3 px-3 py-3 text-left'
          >
            <div className='min-w-0'>
              <p
                className='text-xs font-semibold'
                style={{ color: 'var(--text-primary)' }}
              >
                {app.notes ? 'Catatan tersedia' : 'Tambah catatan'}
              </p>
              {!isOpen && app.notes ? (
                <p
                  className='text-[11px] mt-1'
                  style={{
                    color: 'var(--text-muted)',
                    maxHeight: '2.5rem',
                    overflow: 'hidden',
                  }}
                >
                  {app.notes}
                </p>
              ) : !isOpen && !app.notes ? (
                <p
                  className='text-[11px] mt-1'
                  style={{ color: 'var(--text-muted)' }}
                >
                  Ketuk untuk menulis catatan panjang yang akan tersimpan ke
                  Sheets.
                </p>
              ) : null}
            </div>
            <ChevronDown
              size={12}
              className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {isOpen && (
            <div className='px-3 pb-3 pt-0 flex flex-col gap-3'>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                className='w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 transition-all resize-y'
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder='Tulis catatan di sini...'
              />
              <div className='flex items-center justify-end gap-2'>
                <button
                  type='button'
                  onClick={() => setIsOpen(false)}
                  className='px-3 py-2 rounded-lg text-xs font-semibold transition-colors'
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Batal
                </button>
                <button
                  type='button'
                  onClick={save}
                  className='px-3 py-2 rounded-lg text-xs font-semibold transition-colors'
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--text-inverse)',
                  }}
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-2 w-full max-w-[560px]'>
      <button
        type='button'
        onClick={toggle}
        className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left'
        style={{
          backgroundColor: 'var(--bg-elevated)',
          color: app.notes ? 'var(--text-primary)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        title='Edit catatan'
      >
        <span className='truncate text-left flex items-center gap-2'>
          <span>
            {app.notes ? 'Catatan tersedia' : 'Tambah catatan'}
          </span>
          {app.notes && (
            <span
              className='text-[10px] opacity-60 font-normal'
              style={{ color: 'var(--text-muted)' }}
            >
              {app.notes.length} karakter
            </span>
          )}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div
          className='rounded-lg p-3 flex flex-col gap-3'
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className='w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all resize-y'
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder='Tulis catatan di sini...'
          />
          <div className='flex items-center justify-end gap-2'>
            <button
              type='button'
              onClick={() => setIsOpen(false)}
              className='px-3 py-2 rounded-lg text-xs font-semibold transition-colors'
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Batal
            </button>
            <button
              type='button'
              onClick={save}
              className='px-3 py-2 rounded-lg text-xs font-semibold transition-colors'
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--text-inverse)',
              }}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      ) : app.notes ? (
        <p
          className='text-xs leading-5 rounded-md px-0 whitespace-pre-wrap'
          style={{ color: 'var(--text-muted)' }}
        >
          {app.notes}
        </p>
      ) : null}
    </div>
  );
};

const Tracker: React.FC<TrackerProps> = ({
  applications,
  onUpdateStatus,
  onDelete,
  onEdit,
  onEditSave,
  onAdd,
  sheetId,
  onSyncFromSheets,
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetId: string | null;
    isSynced: boolean;
  }>({ isOpen: false, targetId: null, isSynced: false });
  const [editConfirmApp, setEditConfirmApp] = useState<JobApplication | null>(
    null,
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newApp, setNewApp] = useState<Partial<JobApplication>>({
    status: 'Applied',
    dateApplied: new Date().toISOString(),
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Applied' | 'No Response' | 'Interviewing' | 'Approve' | 'Decline'
  >('All');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.companyName || !newApp.jobTitle) return;

    if (onAdd) {
      onAdd({
        id: Date.now().toString(),
        companyName: newApp.companyName,
        jobTitle: newApp.jobTitle,
        hrEmail: newApp.hrEmail || '-',
        dateApplied: newApp.dateApplied || new Date().toISOString(),
        status: newApp.status as any,
        location: newApp.location || '',
        method: newApp.method || '',
      });
    }
    setIsAddModalOpen(false);
    setNewApp({ status: 'Applied', dateApplied: new Date().toISOString() });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp || !onEditSave) return;
    onEditSave(editingApp);
    setIsEditModalOpen(false);
    setEditingApp(null);
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.jobTitle?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        app.companyName
          ?.toLowerCase()
          .includes(debouncedSearch.toLowerCase()) ||
        app.hrEmail?.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchesStatus =
        statusFilter === 'All' || app.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    const data: Record<string, number> = {
      Applied: 0,
      'No Response': 0,
      Interviewing: 0,
      Approve: 0,
      Decline: 0,
    };
    applications.forEach((app) => {
      data[app.status] = (data[app.status] || 0) + 1;
    });
    return [
      { name: 'Applied', value: data.Applied },
      { name: 'No Response', value: data['No Response'] },
      { name: 'Interviewing', value: data.Interviewing },
      { name: 'Approve', value: data.Approve },
      { name: 'Decline', value: data.Decline },
    ].filter((item) => item.value > 0);
  }, [applications]);

  const handleEditSaveWrapper = useCallback(
    (app: JobApplication, notes: string) => {
      if (!onEditSave) return;
      onEditSave({ ...app, notes });
    },
    [onEditSave],
  );

  const barData = useMemo(() => {
    const months: Record<string, number> = {};
    applications.forEach((app) => {
      const month = new Date(app.dateApplied).toLocaleString('default', {
        month: 'short',
      });
      months[month] = (months[month] || 0) + 1;
    });
    return Object.keys(months).map((key) => ({
      name: key,
      count: months[key],
    }));
  }, [applications]);

  const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  };

  return (
    <div className='p-4 md:p-6 h-full flex flex-col gap-4 md:gap-6 overflow-y-auto'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0'>
        <div>
          <h2
            className='text-xl md:text-2xl font-bold tracking-tight'
            style={{ color: 'var(--text-primary)' }}
          >
            Application Tracker
          </h2>
          <p
            className='text-sm mt-1'
            style={{ color: 'var(--text-secondary)' }}
          >
            Pantau progres dan status semua lamaran kerja Anda di sini.
          </p>
        </div>
        <div
          className='rounded-lg px-4 py-2 flex items-center gap-4'
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className='text-center'>
            <p className='text-xs' style={{ color: 'var(--text-muted)' }}>
              Total Applied
            </p>
            <p
              className='text-xl font-black'
              style={{ color: 'var(--text-primary)' }}
            >
              {applications.length}
            </p>
          </div>
        </div>
      </div>

      {applications.length > 0 && (
        <div className='hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 shrink-0'>
          <div
            className='rounded-xl p-5 flex flex-col min-h-[220px]'
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              className='text-sm font-semibold mb-4'
              style={{ color: 'var(--text-secondary)' }}
            >
              Status Overview
            </h3>
            <div className='flex-1 flex flex-col sm:flex-row items-center justify-center gap-6'>
              <div className='w-full h-32 sm:h-full sm:flex-1'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={stats}
                      cx='50%'
                      cy='50%'
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={5}
                      dataKey='value'
                    >
                      {stats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[entry.name]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className='flex flex-row sm:flex-col flex-wrap justify-center gap-x-4 gap-y-2'>
                {stats.map((s) => (
                  <div
                    key={s.name}
                    className='flex items-center gap-2 text-[10px] sm:text-xs'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <div
                      className='w-2 h-2 rounded-full shrink-0'
                      style={{ backgroundColor: CHART_COLORS[s.name] }}
                    ></div>
                    <span className='whitespace-nowrap'>
                      {s.name} ({s.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className='rounded-xl p-5 flex flex-col h-48 md:h-full'
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              className='text-sm font-semibold mb-4'
              style={{ color: 'var(--text-secondary)' }}
            >
              Applications over Time
            </h3>
            <div className='flex-1'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={barData}>
                  <XAxis
                    dataKey='name'
                    stroke='var(--text-muted)'
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'var(--bg-elevated)' }}
                  />
                  <Bar
                    dataKey='count'
                    fill='var(--text-secondary)'
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div
        className='flex-1 rounded-xl min-h-0 flex flex-col overflow-hidden'
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Search & Filter Header */}
        <div
          className='p-4 flex flex-col sm:flex-row gap-4 sticky top-0 z-10 backdrop-blur-md bg-opacity-80 items-center justify-between'
          style={{
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className='flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1'>
            <ApplicationSearch value={searchQuery} onChange={setSearchQuery} />
            <StatusFilter
              currentStatus={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </div>
          <div className='flex items-center gap-2'>
            {sheetId && (
              <button
                onClick={async () => {
                  if (!onSyncFromSheets || isSyncing) return;
                  setIsSyncing(true);
                  await onSyncFromSheets();
                  setIsSyncing(false);
                }}
                disabled={isSyncing}
                className='flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 active:scale-95 hover:opacity-90 disabled:opacity-50'
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
                title='Sync from Sheets'
              >
                {isSyncing ? (
                  <RefreshCw size={14} className='animate-spin' />
                ) : (
                  <Download size={14} />
                )}
                <span className='hidden sm:inline'>From Sheets</span>
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className='flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shrink-0 active:scale-95 hover:opacity-90'
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--text-inverse)',
              }}
            >
              <Plus size={16} /> Tambah Manual
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className='hidden md:block overflow-auto flex-1'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr
                className='text-xs uppercase tracking-wider sticky top-0 z-10'
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                }}
              >
                <th
                  className='p-4 font-semibold min-w-[200px]'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Perusahaan & Posisi
                </th>
                <th
                  className='p-4 font-semibold'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Tanggal Apply
                </th>
                <th
                  className='p-4 font-semibold'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Melamar Lewat
                </th>
                <th
                  className='p-4 font-semibold'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Email Company
                </th>
                <th
                  className='p-4 font-semibold'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Lokasi
                </th>
                <th
                  className='p-4 font-semibold text-right'
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className='p-12 text-center'>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className='flex flex-col items-center gap-3'
                    >
                      <div className='p-4 rounded-full bg-blue-500/10 text-blue-400'>
                        <SearchX size={40} />
                      </div>
                      <div>
                        <p
                          className='text-lg font-bold'
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Tidak ada aplikasi yang cocok
                        </p>
                        <p
                          className='text-sm mt-1'
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Coba gunakan kata kunci lain atau reset filter status.
                        </p>
                      </div>
                      {(searchQuery || statusFilter !== 'All') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('All');
                          }}
                          className='mt-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors'
                        >
                          Reset Semua Filter
                        </button>
                      )}
                    </motion.div>
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <React.Fragment key={app.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className='transition-colors hover:bg-white/[0.02]'
                    >
                      <td className='p-4'>
                        <div className='flex flex-col'>
                          <span
                            className='font-bold flex items-center gap-2'
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <Briefcase
                              size={14}
                              style={{ color: 'var(--text-secondary)' }}
                            />
                            {app.jobTitle || 'Posisi Tidak Diketahui'}
                          </span>
                          <span
                            className='text-sm flex items-center gap-2 mt-1'
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Building2 size={14} />
                            {app.companyName || 'Perusahaan Tidak Diketahui'}
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <span className='text-xs'>{app.hrEmail}</span>
                          </span>
                        </div>
                      </td>
                      <td className='p-4'>
                        <span
                          className='text-sm flex items-center gap-2'
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Calendar
                            size={14}
                            style={{ color: 'var(--text-muted)' }}
                          />
                          {safeFormatDate(app.dateApplied)}
                        </span>
                      </td>
                      <td className='p-4'>
                        <span
                          className='text-sm'
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {app.method || '-'}
                        </span>
                      </td>
                      <td className='p-4'>
                        <span
                          className='text-sm'
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {app.hrEmail && app.hrEmail !== '-' ? app.hrEmail : '-'}
                        </span>
                      </td>
                      <td className='p-4'>
                        <span
                          className='text-sm'
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {app.location || '-'}
                        </span>
                      </td>
                      <td className='p-4 text-right'>
                        <div className='flex items-center justify-end gap-2'>
                          <div className='relative inline-block text-left'>
                            <button
                              onClick={() =>
                                setOpenDropdownId(
                                  openDropdownId === app.id ? null : app.id,
                                )
                              }
                              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all'
                              style={statusStyles[app.status]}
                            >
                              {statusIcons[app.status]} {app.status}{' '}
                              <ChevronDown
                                size={12}
                                className='ml-1 opacity-70'
                              />
                            </button>
                            {openDropdownId === app.id && (
                              <>
                                <div
                                  className='fixed inset-0 z-10'
                                  onClick={() => setOpenDropdownId(null)}
                                ></div>
                                <div
                                  className='absolute right-0 mt-2 w-36 rounded-lg shadow-xl z-20 overflow-hidden'
                                  style={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  {(
                                    [
                                      'Applied',
                                      'No Response',
                                      'Interviewing',
                                      'Approve',
                                      'Decline',
                                    ] as const
                                  ).map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        onUpdateStatus(app.id, s);
                                        setOpenDropdownId(null);
                                      }}
                                      className='w-full text-left px-4 py-2 text-sm transition-colors'
                                      style={{ color: 'var(--text-secondary)' }}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditingApp(app);
                              setIsEditModalOpen(true);
                            }}
                            className='p-1.5 rounded-md transition-colors'
                            style={{ color: 'var(--text-muted)' }}
                            title='Edit Lamaran'
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (app.sheetRowIndex) setEditConfirmApp(app);
                              else onEdit(app);
                            }}
                            className='p-1.5 rounded-md transition-colors'
                            style={{ color: 'var(--text-muted)' }}
                            title='Kirim Email Lamaran'
                          >
                            <Send size={16} />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                targetId: app.id,
                                isSynced: !!app.sheetRowIndex,
                              })
                            }
                            className='p-1.5 rounded-md transition-colors text-rose-500/60 hover:text-rose-500'
                            title='Hapus Lamaran'
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                    <tr
                      style={{ borderBottom: '1px solid var(--border-muted)' }}
                    >
                      <td colSpan={6} className='p-0'>
                        <div className='pl-8 pr-4 pb-3 pt-0'>
                          <NotesRow
                            app={app}
                            onSave={handleEditSaveWrapper}
                            variant='desktop'
                          />
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className='md:hidden flex flex-col overflow-auto flex-1'>
          {filteredApplications.length === 0 ? (
            <div className='p-12 text-center'>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className='flex flex-col items-center gap-3'
              >
                <div className='p-4 rounded-full bg-blue-500/10 text-blue-400'>
                  <SearchX size={32} />
                </div>
                <div>
                  <p
                    className='text-base font-bold'
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Tidak ada aplikasi yang cocok
                  </p>
                  <p
                    className='text-xs mt-1'
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Coba gunakan kata kunci lain.
                  </p>
                </div>
                {(searchQuery || statusFilter !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('All');
                    }}
                    className='mt-2 text-xs font-semibold text-blue-400'
                  >
                    Reset Filter
                  </button>
                )}
              </motion.div>
            </div>
          ) : (
            filteredApplications.map((app) => (
              <div
                key={app.id}
                className='p-4 flex flex-col gap-3 transition-colors'
                style={{ borderBottom: '1px solid var(--border-muted)' }}
              >
                <div className='flex justify-between items-start gap-3'>
                  <div className='flex flex-col gap-1 flex-1 min-w-0'>
                    <span
                      className='font-bold text-sm leading-tight truncate flex items-center gap-2'
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Briefcase
                        size={14}
                        className='shrink-0'
                        style={{ color: 'var(--text-secondary)' }}
                      />
                      {app.jobTitle}
                    </span>
                    <span
                      className='text-xs flex items-center gap-2 truncate'
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Building2 size={12} className='shrink-0' />
                      {app.companyName}
                    </span>
                  </div>
                  <div className='relative shrink-0'>
                    <button
                      onClick={() =>
                        setOpenDropdownId(
                          openDropdownId === app.id ? null : app.id,
                        )
                      }
                      className='inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold'
                      style={statusStyles[app.status]}
                    >
                      {app.status}{' '}
                      <ChevronDown size={10} className='opacity-70' />
                    </button>
                    {openDropdownId === app.id && (
                      <>
                        <div
                          className='fixed inset-0 z-10'
                          onClick={() => setOpenDropdownId(null)}
                        ></div>
                        <div
                          className='absolute right-0 mt-2 w-32 rounded-xl shadow-2xl z-20 overflow-hidden'
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {(
                            [
                              'Applied',
                              'No Response',
                              'Interviewing',
                              'Approve',
                              'Decline',
                            ] as const
                          ).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                onUpdateStatus(app.id, s);
                                setOpenDropdownId(null);
                              }}
                              className='w-full text-left px-4 py-2.5 text-xs transition-colors'
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div
                  className='flex items-center justify-between text-[11px] px-1'
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className='flex items-center gap-1.5'>
                    <Calendar size={11} /> {safeFormatDate(app.dateApplied)}
                  </span>
                  <span className='flex items-center gap-1.5 truncate ml-3'>
                    <Users size={11} />{' '}
                    {app.hrEmail && app.hrEmail !== '-' ? app.hrEmail : '-'}
                  </span>
                </div>
                <div
                  className='flex items-center gap-2 text-[11px] px-1'
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>Lewat: {app.method || '-'}</span>
                </div>

                <NotesRow app={app} onSave={handleEditSaveWrapper} variant='mobile' />

                <div className='flex justify-between items-center gap-3'>
                  <button
                    onClick={() => {
                      setEditingApp(app);
                      setIsEditModalOpen(true);
                    }}
                    className='flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors'
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (app.sheetRowIndex) setEditConfirmApp(app);
                      else onEdit(app);
                    }}
                    className='flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors'
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Send size={13} /> Kirim Email
                  </button>
                  <button
                    onClick={() =>
                      setConfirmModal({
                        isOpen: true,
                        targetId: app.id,
                        isSynced: !!app.sheetRowIndex,
                      })
                    }
                    className='p-2 rounded-lg transition-colors text-rose-500/60 hover:text-rose-500'
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title='Hapus Lamaran'
        message={
          confirmModal.isSynced
            ? 'Lamaran ini berasal dari Google Sheets. Data akan dihapus dari sheet juga. Lanjutkan?'
            : 'Yakin ingin menghapus lamaran ini? Data tidak dapat dikembalikan.'
        }
        onConfirm={() => {
          if (confirmModal.targetId) onDelete(confirmModal.targetId);
          setConfirmModal({ isOpen: false, targetId: null, isSynced: false });
        }}
        onCancel={() =>
          setConfirmModal({ isOpen: false, targetId: null, isSynced: false })
        }
        confirmText='Hapus'
      />

      <ConfirmModal
        isOpen={editConfirmApp !== null}
        title='Edit Lamaran'
        message='Lamaran ini berasal dari Google Sheets. Perubahan yang disimpan hanya akan tersimpan di aplikasi. Untuk menyinkronkan kembali ke sheet, perbarui status setelah selesai.'
        onConfirm={() => {
          if (editConfirmApp) onEdit(editConfirmApp);
          setEditConfirmApp(null);
        }}
        onCancel={() => setEditConfirmApp(null)}
        confirmText='Lanjutkan'
        cancelText='Batal'
      />

      {/* Manual Add Modal */}
      {isAddModalOpen && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div
            className='absolute inset-0 bg-black/60 backdrop-blur-sm'
            onClick={() => setIsAddModalOpen(false)}
          ></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className='relative w-full max-w-md rounded-2xl p-6 overflow-hidden flex flex-col gap-4 shadow-2xl'
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className='flex items-center justify-between'>
              <h3
                className='text-lg font-bold'
                style={{ color: 'var(--text-primary)' }}
              >
                Tambah Lamaran Manual
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className='p-1 rounded-md transition-colors hover:bg-white/10'
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleAddSubmit}
              className='flex flex-col gap-4 mt-2'
            >
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nama Perusahaan <span className='text-rose-500'>*</span>
                </label>
                <input
                  required
                  type='text'
                  value={newApp.companyName || ''}
                  onChange={(e) =>
                    setNewApp({ ...newApp, companyName: e.target.value })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='PT. Contoh Sukses'
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Posisi Pekerjaan <span className='text-rose-500'>*</span>
                </label>
                <input
                  required
                  type='text'
                  value={newApp.jobTitle || ''}
                  onChange={(e) =>
                    setNewApp({ ...newApp, jobTitle: e.target.value })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='Software Engineer'
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email HR / Kontak (Opsional)
                </label>
                <input
                  type='text'
                  value={newApp.hrEmail || ''}
                  onChange={(e) =>
                    setNewApp({ ...newApp, hrEmail: e.target.value })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='hr@company.com'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Tanggal Apply
                  </label>
                  <input
                    type='date'
                    value={
                      newApp.dateApplied ? newApp.dateApplied.split('T')[0] : ''
                    }
                    onChange={(e) =>
                      setNewApp({
                        ...newApp,
                        dateApplied: new Date(e.target.value).toISOString(),
                      })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Status
                  </label>
                  <select
                    value={newApp.status || 'Applied'}
                    onChange={(e) =>
                      setNewApp({ ...newApp, status: e.target.value as any })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value='Applied'>Applied</option>
                    <option value='No Response'>No Response</option>
                    <option value='Interviewing'>Interviewing</option>
                    <option value='Approve'>Approve</option>
                    <option value='Decline'>Decline</option>
                  </select>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Melamar Lewat
                  </label>
                  <input
                    type='text'
                    value={newApp.method || ''}
                    onChange={(e) =>
                      setNewApp({ ...newApp, method: e.target.value })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder='Email / LinkedIn / Website'
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Lokasi
                  </label>
                  <input
                    type='text'
                    value={newApp.location || ''}
                    onChange={(e) =>
                      setNewApp({ ...newApp, location: e.target.value })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder='Jakarta / Remote'
                  />
                </div>
              </div>

              <button
                type='submit'
                className='w-full mt-4 py-2.5 rounded-lg text-sm font-bold transition-transform active:scale-95'
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--text-inverse)',
                }}
              >
                Simpan Lamaran
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit App Modal */}
      {isEditModalOpen && editingApp && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div
            className='absolute inset-0 bg-black/60 backdrop-blur-sm'
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingApp(null);
            }}
          ></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className='relative w-full max-w-md rounded-2xl p-6 overflow-hidden flex flex-col gap-4 shadow-2xl'
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div className='flex items-center justify-between'>
              <h3
                className='text-lg font-bold'
                style={{ color: 'var(--text-primary)' }}
              >
                Edit Lamaran
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingApp(null);
                }}
                className='p-1 rounded-md transition-colors hover:bg-white/10'
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className='flex flex-col gap-4 mt-2'
            >
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nama Perusahaan <span className='text-rose-500'>*</span>
                </label>
                <input
                  required
                  type='text'
                  value={editingApp.companyName || ''}
                  onChange={(e) =>
                    setEditingApp({
                      ...editingApp,
                      companyName: e.target.value,
                    })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='PT. Contoh Sukses'
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Posisi Pekerjaan <span className='text-rose-500'>*</span>
                </label>
                <input
                  required
                  type='text'
                  value={editingApp.jobTitle || ''}
                  onChange={(e) =>
                    setEditingApp({ ...editingApp, jobTitle: e.target.value })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='Software Engineer'
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email HR / Kontak
                </label>
                <input
                  type='text'
                  value={editingApp.hrEmail || ''}
                  onChange={(e) =>
                    setEditingApp({ ...editingApp, hrEmail: e.target.value })
                  }
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='hr@company.com'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Tanggal Apply
                  </label>
                  <input
                    type='date'
                    value={
                      editingApp.dateApplied
                        ? editingApp.dateApplied.split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditingApp({
                        ...editingApp,
                        dateApplied: new Date(e.target.value).toISOString(),
                      })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Status
                  </label>
                  <select
                    value={editingApp.status || 'Applied'}
                    onChange={(e) =>
                      setEditingApp({
                        ...editingApp,
                        status: e.target.value as any,
                      })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value='Applied'>Applied</option>
                    <option value='No Response'>No Response</option>
                    <option value='Interviewing'>Interviewing</option>
                    <option value='Approve'>Approve</option>
                    <option value='Decline'>Decline</option>
                  </select>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Melamar Lewat
                  </label>
                  <input
                    type='text'
                    value={editingApp.method || ''}
                    onChange={(e) =>
                      setEditingApp({ ...editingApp, method: e.target.value })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder='Email / LinkedIn / Website'
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Lokasi
                  </label>
                  <input
                    type='text'
                    value={editingApp.location || ''}
                    onChange={(e) =>
                      setEditingApp({ ...editingApp, location: e.target.value })
                    }
                    className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all'
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder='Jakarta / Remote'
                  />
                </div>
              </div>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-xs font-semibold'
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Catatan
                </label>
                <textarea
                  value={editingApp.notes || ''}
                  onChange={(e) =>
                    setEditingApp({ ...editingApp, notes: e.target.value })
                  }
                  rows={3}
                  className='rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all resize-none'
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder='Catatan tambahan...'
                />
              </div>

              <button
                type='submit'
                className='w-full mt-4 py-2.5 rounded-lg text-sm font-bold transition-transform active:scale-95'
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--text-inverse)',
                }}
              >
                Simpan Perubahan
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
