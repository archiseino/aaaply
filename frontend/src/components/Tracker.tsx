import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Briefcase, Calendar, ChevronDown, Clock, CheckCircle2, XCircle, Users, Trash2, Edit2, SearchX, Plus, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis } from 'recharts';

import { ConfirmModal } from './ConfirmModal';
import ApplicationSearch from './ApplicationSearch';
import StatusFilter from './StatusFilter';

export interface JobApplication {
  id: string;
  companyName: string;
  jobTitle: string;
  hrEmail: string;
  dateApplied: string;
  status: 'Sent' | 'Interview' | 'Rejected' | 'Accepted';
  subject?: string;
  body?: string;
  contextText?: string;
}

interface TrackerProps {
  applications: JobApplication[];
  onUpdateStatus: (id: string, newStatus: JobApplication['status']) => void;
  onDelete: (id: string) => void;
  onEdit: (app: JobApplication) => void;
  onAdd?: (app: JobApplication) => void;
}

const statusStyles: Record<string, React.CSSProperties> = {
  Sent: { backgroundColor: 'color-mix(in srgb, var(--status-blue) 15%, transparent)', color: 'var(--status-blue)', border: '1px solid color-mix(in srgb, var(--status-blue) 25%, transparent)' },
  Interview: { backgroundColor: 'color-mix(in srgb, var(--status-yellow) 15%, transparent)', color: 'var(--status-yellow)', border: '1px solid color-mix(in srgb, var(--status-yellow) 25%, transparent)' },
  Rejected: { backgroundColor: 'color-mix(in srgb, var(--status-red) 15%, transparent)', color: 'var(--status-red)', border: '1px solid color-mix(in srgb, var(--status-red) 25%, transparent)' },
  Accepted: { backgroundColor: 'color-mix(in srgb, var(--status-green) 15%, transparent)', color: 'var(--status-green)', border: '1px solid color-mix(in srgb, var(--status-green) 25%, transparent)' },
};

const CHART_COLORS: Record<string, string> = {
  Sent: '#6b8aaf',
  Interview: '#b8a44e',
  Rejected: '#b05a5a',
  Accepted: '#5a9e6f',
};

const statusIcons = {
  Sent: <Clock size={14} />,
  Interview: <Users size={14} />,
  Rejected: <XCircle size={14} />,
  Accepted: <CheckCircle2 size={14} />,
};

const Tracker: React.FC<TrackerProps> = ({ applications, onUpdateStatus, onDelete, onEdit, onAdd }) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, targetId: string | null}>({ isOpen: false, targetId: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newApp, setNewApp] = useState<Partial<JobApplication>>({ status: 'Sent', dateApplied: new Date().toISOString() });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Sent' | 'Interview' | 'Rejected' | 'Accepted'>('All');

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
      });
    }
    setIsAddModalOpen(false);
    setNewApp({ status: 'Sent', dateApplied: new Date().toISOString() });
  };

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = 
        app.jobTitle?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        app.companyName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        app.hrEmail?.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [applications, debouncedSearch, statusFilter]);

  const stats = useMemo(() => {
    const data = { Sent: 0, Interview: 0, Rejected: 0, Accepted: 0 };
    applications.forEach(app => { data[app.status]++; });
    return [
      { name: 'Sent', value: data.Sent },
      { name: 'Interview', value: data.Interview },
      { name: 'Rejected', value: data.Rejected },
      { name: 'Accepted', value: data.Accepted },
    ].filter(item => item.value > 0);
  }, [applications]);

  const barData = useMemo(() => {
    const months: Record<string, number> = {};
    applications.forEach(app => {
      const month = new Date(app.dateApplied).toLocaleString('default', { month: 'short' });
      months[month] = (months[month] || 0) + 1;
    });
    return Object.keys(months).map(key => ({ name: key, count: months[key] }));
  }, [applications]);

  const tooltipStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 md:gap-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Application Tracker</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Pantau progres dan status semua lamaran kerja Anda di sini.</p>
        </div>
        <div className="rounded-lg px-4 py-2 flex items-center gap-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Applied</p>
            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{applications.length}</p>
          </div>
        </div>
      </div>

      {applications.length > 0 && (
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 shrink-0">
          <div className="rounded-xl p-5 flex flex-col min-h-[220px]" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Status Overview</h3>
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="w-full h-32 sm:h-full sm:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                      {stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-row sm:flex-col flex-wrap justify-center gap-x-4 gap-y-2">
                {stats.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[s.name] }}></div>
                    <span className="whitespace-nowrap">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-5 flex flex-col h-48 md:h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Applications over Time</h3>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg-elevated)' }} />
                  <Bar dataKey="count" fill="var(--text-secondary)" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 rounded-xl min-h-0 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Search & Filter Header */}
        <div className="p-4 flex flex-col sm:flex-row gap-4 sticky top-0 z-10 backdrop-blur-md bg-opacity-80 items-center justify-between" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
            <ApplicationSearch value={searchQuery} onChange={setSearchQuery} />
            <StatusFilter currentStatus={statusFilter} onStatusChange={setStatusFilter} />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shrink-0 active:scale-95 hover:opacity-90"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            <Plus size={16} /> Tambah Manual
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                <th className="p-4 font-semibold min-w-[200px]" style={{ borderBottom: '1px solid var(--border)' }}>Perusahaan & Posisi</th>
                <th className="p-4 font-semibold" style={{ borderBottom: '1px solid var(--border)' }}>Tanggal Apply</th>
                <th className="p-4 font-semibold text-right" style={{ borderBottom: '1px solid var(--border)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-12 text-center">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-blue-500/10 text-blue-400">
                        <SearchX size={40} />
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Tidak ada aplikasi yang cocok</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Coba gunakan kata kunci lain atau reset filter status.</p>
                      </div>
                      {(searchQuery || statusFilter !== 'All') && (
                        <button onClick={() => { setSearchQuery(''); setStatusFilter('All'); }} className="mt-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                          Reset Semua Filter
                        </button>
                      )}
                    </motion.div>
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={app.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <Briefcase size={14} style={{ color: 'var(--text-secondary)' }} />
                          {app.jobTitle || 'Posisi Tidak Diketahui'}
                        </span>
                        <span className="text-sm flex items-center gap-2 mt-1" style={{ color: 'var(--text-secondary)' }}>
                          <Building2 size={14} />
                          {app.companyName || 'Perusahaan Tidak Diketahui'}
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span className="text-xs">{app.hrEmail}</span>
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                        {new Date(app.dateApplied).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative inline-block text-left">
                          <button onClick={() => setOpenDropdownId(openDropdownId === app.id ? null : app.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                            style={statusStyles[app.status]}>
                            {statusIcons[app.status]} {app.status} <ChevronDown size={12} className="ml-1 opacity-70" />
                          </button>
                          {openDropdownId === app.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                              <div className="absolute right-0 mt-2 w-36 rounded-lg shadow-xl z-20 overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                {(['Sent', 'Interview', 'Rejected', 'Accepted'] as const).map((s) => (
                                  <button key={s} onClick={() => { onUpdateStatus(app.id, s); setOpenDropdownId(null); }}
                                    className="w-full text-left px-4 py-2 text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>{s}</button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <button onClick={() => onEdit(app)} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} title="Edit & Resend"><Edit2 size={16} /></button>
                        <button onClick={() => setConfirmModal({ isOpen: true, targetId: app.id })}
                          className="p-1.5 rounded-md transition-colors text-rose-500/60 hover:text-rose-500" title="Hapus Lamaran"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col overflow-auto flex-1">
          {filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-blue-500/10 text-blue-400">
                  <SearchX size={32} />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Tidak ada aplikasi yang cocok</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Coba gunakan kata kunci lain.</p>
                </div>
                {(searchQuery || statusFilter !== 'All') && (
                  <button onClick={() => { setSearchQuery(''); setStatusFilter('All'); }} className="mt-2 text-xs font-semibold text-blue-400">
                    Reset Filter
                  </button>
                )}
              </motion.div>
            </div>
          ) : (
            filteredApplications.map((app) => (
              <div key={app.id} className="p-4 flex flex-col gap-3 transition-colors" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-bold text-sm leading-tight truncate flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Briefcase size={14} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
                      {app.jobTitle}
                    </span>
                    <span className="text-xs flex items-center gap-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                      <Building2 size={12} className="shrink-0" />
                      {app.companyName}
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <button onClick={() => setOpenDropdownId(openDropdownId === app.id ? null : app.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold"
                      style={statusStyles[app.status]}>
                      {app.status} <ChevronDown size={10} className="opacity-70" />
                    </button>
                    {openDropdownId === app.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-0 mt-2 w-32 rounded-xl shadow-2xl z-20 overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                          {(['Sent', 'Interview', 'Rejected', 'Accepted'] as const).map((s) => (
                            <button key={s} onClick={() => { onUpdateStatus(app.id, s); setOpenDropdownId(null); }}
                              className="w-full text-left px-4 py-2.5 text-xs transition-colors" style={{ color: 'var(--text-secondary)' }}>{s}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[11px] px-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={11} /> {new Date(app.dateApplied).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5 truncate ml-3">
                    <Users size={11} /> {app.hrEmail}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <button onClick={() => onEdit(app)} 
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <Edit2 size={13} /> Edit & Resend
                  </button>
                  <button onClick={() => setConfirmModal({ isOpen: true, targetId: app.id })} 
                    className="p-2 rounded-lg transition-colors text-rose-500/60 hover:text-rose-500">
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
        title="Hapus Lamaran"
        message="Yakin ingin menghapus lamaran ini? Data tidak dapat dikembalikan."
        onConfirm={() => {
          if (confirmModal.targetId) onDelete(confirmModal.targetId);
          setConfirmModal({ isOpen: false, targetId: null });
        }}
        onCancel={() => setConfirmModal({ isOpen: false, targetId: null })}
      />

      {/* Manual Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md rounded-2xl p-6 overflow-hidden flex flex-col gap-4 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Tambah Lamaran Manual</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-md transition-colors hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Nama Perusahaan <span className="text-rose-500">*</span></label>
                <input required type="text" value={newApp.companyName || ''} onChange={e => setNewApp({...newApp, companyName: e.target.value})} className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} placeholder="PT. Contoh Sukses" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Posisi Pekerjaan <span className="text-rose-500">*</span></label>
                <input required type="text" value={newApp.jobTitle || ''} onChange={e => setNewApp({...newApp, jobTitle: e.target.value})} className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} placeholder="Software Engineer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Email HR / Kontak (Opsional)</label>
                <input type="text" value={newApp.hrEmail || ''} onChange={e => setNewApp({...newApp, hrEmail: e.target.value})} className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} placeholder="hr@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Tanggal Apply</label>
                  <input type="date" value={newApp.dateApplied ? newApp.dateApplied.split('T')[0] : ''} onChange={e => setNewApp({...newApp, dateApplied: new Date(e.target.value).toISOString()})} className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</label>
                  <select value={newApp.status || 'Sent'} onChange={e => setNewApp({...newApp, status: e.target.value as any})} className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <option value="Sent">Sent</option>
                    <option value="Interview">Interview</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Accepted">Accepted</option>
                  </select>
                </div>
              </div>
              
              <button type="submit" className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold transition-transform active:scale-95" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
                Simpan Lamaran
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
