import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Briefcase, Mail, ExternalLink, RefreshCw, ChevronRight, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

import { ConfirmModal } from '../ui/ConfirmModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  description?: string;
  email?: string;
  image_url?: string;
  category: string;
  posted_at?: string;
  scraped_at: string;
}

interface JobFinderProps {
  onApply: (job: Job) => void;
  onAddExternalApplication: (app: any) => void;
  notify: (msg: string, type?: any) => void;
}

const CATEGORIES = ["All", "Engineering", "Technology", "Finance", "Operations", "Creative", "General"];
const SOURCES = ["Semua Sumber", "LinkedIn", "Kalibrr", "Disnakerja"];

const formatDate = (raw: string | undefined): string => {
  if (!raw) return 'Baru';
  // Already formatted (e.g. "Hari ini", "3 hari lalu")
  if (!raw.includes('T') && !raw.match(/^\d{4}-\d{2}-\d{2}$/)) return raw;
  try {
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return raw;
    const now = new Date();
    const diff = Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7) return `${diff} hari lalu`;
    if (diff < 30) return `${Math.floor(diff / 7)} minggu lalu`;
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return raw; }
};

const JobFinder: React.FC<JobFinderProps> = ({ onApply, onAddExternalApplication, notify }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSource, setSelectedSource] = useState('Semua Sumber');
  const [searchCity, setSearchCity] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest'|'oldest'>('newest');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const JOBS_PER_PAGE = 20;

  // Reset pagination when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedSource, searchCity, sortOrder]);
  
  // External link tracking state
  const [externalJobModal, setExternalJobModal] = useState<Job | null>(null);

  // Pull to refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [startY, setStartY] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/jobs`, {
        params: {
          category: selectedCategory,
          search: searchQuery
        }
      });
      setJobs(res.data);
    } catch (err) {
      console.error(err);
      notify("Gagal memuat lowongan", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();
  }, [selectedCategory]);

  const handleScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/jobs/scrape`, null, {
        params: { category: selectedCategory }
      });
      notify(`Ditemukan ${res.data.synced || res.data.count} lowongan baru!`, "success");
      fetchJobs();
    } catch (err) {
      notify("Gagal mencari lowongan baru", "error");
    } finally {
      setScraping(false);
    }
  };

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      setStartY(e.touches[0].pageY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;
    
    if (diff > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
      // Apply some resistance
      const distance = Math.min(diff * 0.4, PULL_THRESHOLD + 20);
      setPullDistance(distance);
      
      // Prevent body scroll when pulling
      if (distance > 10) {
        if (e.cancelable) e.preventDefault();
      }
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling && pullDistance >= PULL_THRESHOLD) {
      handleScrape();
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  const handleExternalClick = (e: React.MouseEvent, job: Job) => {
    e.preventDefault();
    window.open(job.url, '_blank');
    setExternalJobModal(job);
  };

  const handleConfirmExternal = () => {
    if (externalJobModal) {
      onAddExternalApplication({
        id: Date.now().toString(),
        companyName: externalJobModal.company,
        jobTitle: externalJobModal.title,
        hrEmail: externalJobModal.source, // Use source as fallback for manual external apps
        dateApplied: new Date().toISOString(),
        status: 'Applied'
      });
      notify("Lamaran ditambahkan ke Tracker!", "success");
    }
    setExternalJobModal(null);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = job.location.toLowerCase().includes(searchCity.toLowerCase());
    const matchesSource = selectedSource === 'Semua Sumber' || job.source === selectedSource;
    return matchesSearch && matchesCity && matchesSource;
  }).sort((a, b) => {
    const dateA = new Date(a.posted_at || Date.now()).getTime();
    const dateB = new Date(b.posted_at || Date.now()).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + JOBS_PER_PAGE);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header with Search */}
      <div className="p-4 md:p-6 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                type="text" 
                placeholder="Cari posisi atau perusahaan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm transition-all focus:outline-none focus:ring-1"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                <input 
                  type="text" 
                  placeholder="Kota..."
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm transition-all focus:outline-none focus:ring-1"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <button 
                onClick={fetchJobs}
                className="px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0"
                style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)' }}
              >
                Cari
              </button>
            </div>
          </div>

          {/* Row 2: Categories scroll list (spanning full width) */}
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap transition-all`}
                  style={selectedCategory === cat 
                    ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--accent)' } 
                    : { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          {/* Row 3: Unified Filters and Actions for both Mobile and Desktop */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="text-[10px] md:text-xs bg-transparent border rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 cursor-pointer transition-all appearance-none"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>

              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="text-[10px] md:text-xs bg-transparent border rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 cursor-pointer transition-all appearance-none"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>

            <button 
              onClick={handleScrape}
              disabled={scraping}
              className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-30 whitespace-nowrap cursor-pointer hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <RefreshCw size={12} className={scraping ? "animate-spin" : ""} />
              {scraping ? "Mencari..." : "Perbarui Data"}
            </button>
          </div>
        </div>
      </div>

      {/* Results Area with Pull to Refresh */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        <motion.div 
          className="absolute left-0 right-0 top-0 flex justify-center items-center pointer-events-none z-10"
          style={{ height: pullDistance }}
          animate={{ opacity: pullDistance > 20 ? 1 : 0 }}
        >
          <div 
            className="flex items-center gap-2 px-4 py-1.5 rounded-full shadow-lg border"
            style={{ 
              backgroundColor: 'var(--bg-elevated)', 
              borderColor: 'var(--border)',
              transform: `rotate(${pullDistance * 2}deg)`
            }}
          >
             {pullDistance >= PULL_THRESHOLD ? (
               <RefreshCw size={14} className={scraping ? "animate-spin" : ""} style={{ color: 'var(--accent)' }} />
             ) : (
               <ArrowDown size={14} style={{ color: 'var(--text-secondary)' }} />
             )}
             <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {pullDistance >= PULL_THRESHOLD ? "Lepas untuk Perbarui" : "Tarik untuk Perbarui"}
             </span>
          </div>
        </motion.div>

        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <div className="w-10 h-10 border-2 rounded-full animate-spin mb-4" style={{ borderColor: 'transparent', borderTopColor: 'var(--text-primary)' }}></div>
              <p className="text-sm">Sedang mencari...</p>
            </div>
          ) : paginatedJobs.length > 0 ? (
            <>
              {paginatedJobs.map((job, idx) => (
                <motion.div 
                  key={job.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group p-4 md:p-5 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-5 transition-all hover:translate-x-1"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-start gap-3 md:gap-4">
                      {job.image_url && (
                        <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-lg overflow-hidden border bg-white flex items-center justify-center" style={{ borderColor: 'var(--border)' }}>
                          <img src={job.image_url} alt="Logo" className="w-full h-full object-contain p-1" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm md:text-base font-bold group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>{job.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{job.company}</span>
                              <span className="w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: 'var(--text-muted)' }}></span>
                              <span className="text-[10px] md:text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><MapPin size={12} /> {job.location}</span>
                              <span className="w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: 'var(--text-muted)' }}></span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-accent/10 text-accent uppercase tracking-wider">{formatDate(job.posted_at)}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 opacity-40 uppercase tracking-widest">{job.source}</span>
                        </div>
                      </div>
                    </div>

                    {job.description && (
                      <p className="text-[10px] md:text-xs line-clamp-2 opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {job.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-1 md:mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{job.category}</span>
                      {job.email && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1" style={{ backgroundColor: 'var(--status-green)20', color: 'var(--status-green)' }}>
                          <Mail size={10} /> {job.email}
                        </span>
                      )}
                    </div>
                  </div>

                    <div className="flex md:flex-col gap-2 justify-center shrink-0">
                      {job.email && (
                        <button 
                          onClick={() => onApply(job)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all"
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                        >
                          Auto-Apply <ChevronRight size={14} />
                        </button>
                      )}
                      <a 
                        href={job.url} 
                        onClick={(e) => handleExternalClick(e, job)}
                        className="flex items-center justify-center p-2 rounded-xl opacity-40 hover:opacity-100 hover:bg-white/5 transition-all"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                </motion.div>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button 
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      if (scrollRef.current) scrollRef.current.scrollTop = 0;
                    }}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-30 transition-all"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button 
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      if (scrollRef.current) scrollRef.current.scrollTop = 0;
                    }}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-30 transition-all"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
              <Briefcase size={48} className="mb-4" />
              <h3 className="text-lg font-bold">Tidak ada lowongan</h3>
              <p className="text-sm max-w-xs mx-auto">Coba ganti kategori atau tarik layar ke bawah untuk mencari lowongan baru.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!externalJobModal}
        title="Simpan Riwayat Lamaran?"
        message={`Apakah Anda sudah melamar posisi "${externalJobModal?.title}" di "${externalJobModal?.company}" melalui situs aslinya? Jika ya, simpan ke Tracker agar mudah dipantau.`}
        confirmText="Ya, Simpan"
        cancelText="Batal"
        onConfirm={handleConfirmExternal}
        onCancel={() => setExternalJobModal(null)}
      />
    </div>
  );
};

export default JobFinder;

