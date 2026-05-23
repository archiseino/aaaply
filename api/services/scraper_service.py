"""
SobatApply Omni-Intelligence Scraper Engine v5.0
=================================================
- All lightweight scrapers (httpx only, NO browser needed)
- Works on Vercel, GitHub Actions, and Local
- 28-day data retention policy
- Parallel execution with semaphore protection
"""
import asyncio
import os
import random
import re
import time
import base64
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs, quote_plus
from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from ..models import ScrapedJob
import logging

# Stealth headers
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 OPR/109.0.0.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
]

EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

try:
    from playwright.async_api import async_playwright
    from playwright_stealth import stealth_async
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


def _format_date_iso(raw: str) -> Optional[str]:
    """Convert raw dates to ISO format and return None if older than 28 days."""
    if not raw or raw in ["Baru", "Baru saja"]:
        return datetime.now().isoformat()
    try:
        # Handling common relative Indonesian dates
        raw_lower = raw.lower()
        if "hari ini" in raw_lower:
            return datetime.now().isoformat()
        if "kemarin" in raw_lower:
            return (datetime.now() - timedelta(days=1)).isoformat()
        if "hari" in raw_lower and "lalu" in raw_lower:
            days = int(re.search(r'\d+', raw_lower).group())
            if days > 28: return None
            return (datetime.now() - timedelta(days=days)).isoformat()
        if "minggu" in raw_lower and "lalu" in raw_lower:
            weeks = int(re.search(r'\d+', raw_lower).group())
            if weeks * 7 > 28: return None
            return (datetime.now() - timedelta(weeks=weeks)).isoformat()
        if "bulan" in raw_lower and "lalu" in raw_lower:
            return None # Older than a month

        # Parse ISO or standard dates
        dt = datetime.fromisoformat(raw.replace("+00:00", "").replace("Z", ""))
        if (datetime.now() - dt).days > 28:
            return None
        return dt.isoformat()
    except:
        # If we can't parse it, reject it — no more free passes
        return None


class ScraperService:
    CATEGORIES = {
        "Engineering": [
            "Teknik Sipil", "Civil Engineer", "Teknik Geodesi", "Geodesy", "Surveyor", "Geomatika", "GIS Specialist", "Topografi", "Geotechnical", "Site Engineer", "Ahli K3 Konstruksi", "Estimator", "Drafter", "AutoCAD",
            "Teknik Sipil", "Civil Engineer", "Teknik Geodesi", "Geodesy", "Surveyor", "Geomatika", "GIS Specialist", "Topografi", "Geotechnical", "Site Engineer",
            "Mechanical Engineer", "Electrical Engineer", "Mining Engineer", "Pipeline Engineer", "Process Engineer", "Instrument Engineer", "Teknik Pertambangan", "Teknik Mesin", "QA/QC Engineer", "Welding Inspector", "HSE Officer", "Safety Officer"
        ],
        "Technology": ["Software Engineer", "Web Developer", "Data Science", "UI/UX Designer", "IT Support", "Programmer", "Cyber Security", "Mobile Developer", "Backend Engineer", "Cloud Engineer", "Fullstack Developer", "DevOps", "QA Engineer", "System Analyst", "Data Analyst", "Machine Learning", "Frontend Developer", "Network Engineer", "IT Security"],
        "Finance": ["Accounting", "Akuntansi", "Finance", "Keuangan", "Tax Consultant", "Auditor", "Financial Analyst", "Payroll", "Account Payable", "Account Receivable", "Tax Staff", "Finance Controller", "Investment Analyst"],
        "Operations": ["Warehouse Staff", "Logistic Coordinator", "Admin Gudang", "Supply Chain", "Purchasing", "Procurement", "Operations Manager", "Quality Control", "Quality Assurance", "Factory Manager", "PPIC", "Inventory Control", "Production Supervisor"],
        "Creative": ["Digital Marketing", "Content Creator", "Social Media Specialist", "Graphic Designer", "Copywriter", "Video Editor", "SEO Specialist", "Marketing Communication", "Art Director", "Brand Manager", "Creative Director", "Photographer", "Motion Graphic"],
        "General": ["Administration", "Administrasi", "Sales", "Customer Service", "Sekretaris", "Receptionist", "General Affair", "Data Entry", "Staff Kantor", "Business Development", "Human Resources", "HRD", "Recruitment", "Talent Acquisition", "Account Executive", "Telesales"]
    }

    def __init__(self):
        self.logger = logging.getLogger("sobatapply.scraper")
        self.user_data_dir = os.path.abspath("user_data")
        try:
            if not os.path.exists(self.user_data_dir):
                os.makedirs(self.user_data_dir)
        except OSError:
            pass
        self.semaphore = asyncio.Semaphore(5)
        self.health_stats = {}

    def _track_health(self, source: str, success: bool):
        if source not in self.health_stats:
            self.health_stats[source] = {"success": 0, "fail": 0}
        self.health_stats[source]["success" if success else "fail"] += 1

    async def _fetch_with_retry(self, client: httpx.AsyncClient, url: str, method: str = "GET", retries: int = 2, **kwargs) -> Optional[httpx.Response]:
        for attempt in range(retries + 1):
            try:
                res = await client.request(method, url, **kwargs)
                if res.status_code in [429, 500, 502, 503, 504]:
                    raise Exception(f"Status {res.status_code}")
                return res
            except Exception as e:
                if attempt == retries:
                    self.logger.debug(f"Request failed for {url} after {retries} retries: {e}")
                    return None
                await asyncio.sleep(2 ** attempt)
        return None

    def _get_headers(self) -> dict:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    def _extract_emails(self, text: str) -> List[str]:
        if not text: return []
        return list(set(re.findall(EMAIL_REGEX, text, re.IGNORECASE)))

    # ═══════════════════════════════════════════════════════════════
    #  LIGHTWEIGHT SCRAPERS (httpx only — works on Vercel!)
    # ═══════════════════════════════════════════════════════════════

    async def scrape_kalibrr(self, query: str, category: str, client: httpx.AsyncClient) -> List[ScrapedJob]:
        """Kalibrr API — Most reliable source."""
        jobs = []
        try:
            url = f"https://www.kalibrr.id/api/job_board/search?text={quote_plus(query)}&country=Indonesia&limit=70"
            res = await self._fetch_with_retry(client, url, headers=self._get_headers())
            if not res or res.status_code != 200:
                self._track_health("Kalibrr", False)
                return jobs
                
            data = res.json()
            if "jobs" in data:
                for j in data["jobs"]:
                    company_info = j.get("company_info", {})
                    code = company_info.get("code", "")
                    job_url = f"https://www.kalibrr.id/c/{code}/jobs/{j.get('id')}" if code else "https://www.kalibrr.id"
                    desc_text = re.sub(r'<[^>]+>', ' ', j.get("description", "")).strip()
                    raw_date = j.get("activated_at", j.get("created_at", ""))
                    iso_date = _format_date_iso(raw_date)
                    if not iso_date: continue
                    
                    emails = self._extract_emails(desc_text)
                    
                    jobs.append(ScrapedJob(
                        title=j.get("name", "Unknown"),
                        company=company_info.get("name", "Unknown"),
                        location=j.get("google_location", {}).get("address_components", {}).get("city", "Indonesia"),
                        source="Kalibrr",
                        url=job_url,
                        description=desc_text[:300] + "..." if len(desc_text) > 300 else desc_text,
                        email=emails[0] if emails else None,
                        image_url=company_info.get("logo"),
                        category=category,
                        posted_at=iso_date,
                        scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                    ))
            self._track_health("Kalibrr", True)
        except Exception as e:
            self.logger.warning(f"Kalibrr error: {e}")
            self._track_health("Kalibrr", False)
        return jobs

    async def scrape_linkedin_guest(self, query: str, category: str) -> List[ScrapedJob]:
        """LinkedIn Guest API — No login required, httpx only."""
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                for start in [0, 25, 50, 75, 100, 125]:
                    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={quote_plus(query)}&location=Indonesia&start={start}&f_TPR=r2592000"
                    headers = self._get_headers()
                    headers["Accept"] = "text/html"
                    res = await client.get(url, headers=headers)
                    if res.status_code != 200:
                        continue
                    
                    soup = BeautifulSoup(res.text, 'html.parser')
                    cards = soup.find_all('li')
                    if not cards:
                        break
                    
                    for card in cards[:25]:
                        try:
                            title_elem = card.find('h3', class_='base-search-card__title')
                            company_elem = card.find('h4', class_='base-search-card__subtitle')
                            location_elem = card.find('span', class_='job-search-card__location')
                            link_elem = card.find('a', class_='base-card__full-link')
                            time_elem = card.find('time')
                            
                            if not title_elem or not link_elem: continue
                            
                            raw_date = time_elem.get('datetime', '') if time_elem else ''
                            href = link_elem.get('href', '').split('?')[0]
                            
                            iso_date = _format_date_iso(raw_date)
                            if not iso_date: continue
                            
                            jobs.append(ScrapedJob(
                                title=title_elem.text.strip(),
                                company=company_elem.text.strip() if company_elem else "Perusahaan",
                                location=location_elem.text.strip() if location_elem else "Indonesia",
                                source="LinkedIn",
                                url=href,
                                description=f"Lowongan {query} di LinkedIn.",
                                category=category,
                                posted_at=iso_date,
                                scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                            ))
                        except: continue
        except Exception as e:
            self.logger.warning(f"LinkedIn Guest error: {e}")
        return jobs



    async def scrape_indeed_html(self, query: str, category: str, client: httpx.AsyncClient) -> List[ScrapedJob]:
        """Indeed Indonesia — Parse search results HTML (no JS needed)."""
        jobs = []
        try:
            url = f"https://id.indeed.com/jobs?q={quote_plus(query)}&l=Indonesia"
            res = await self._fetch_with_retry(client, url, headers=self._get_headers())
            if not res or res.status_code != 200:
                self._track_health("Indeed", False)
                return jobs
                
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Indeed uses mosaic-provider-jobcards
            cards = soup.find_all('div', class_='job_seen_beacon')
            if not cards:
                # Try alternative selector
                cards = soup.find_all('div', {'class': re.compile(r'cardOutline|result')})
            
            for card in cards[:10]:
                try:
                    title_elem = card.find('h2', class_=re.compile(r'jobTitle'))
                    if not title_elem:
                        title_elem = card.find('a', {'class': re.compile(r'jcs-JobTitle')})
                    company_elem = card.find('span', {'data-testid': 'company-name'})
                    if not company_elem:
                        company_elem = card.find('span', class_=re.compile(r'company'))
                    location_elem = card.find('div', {'data-testid': 'text-location'})
                    link_elem = card.find('a', href=True)
                    date_elem = card.find('span', class_=re.compile(r'date'))
                    
                    if not title_elem: continue
                    
                    href = link_elem.get('href', '') if link_elem else ''
                    if href and not href.startswith('http'):
                        href = "https://id.indeed.com" + href
                    
                    raw_date = date_elem.text.strip() if date_elem else "Baru"
                    iso_date = _format_date_iso(raw_date)
                    if not iso_date: continue
                    
                    desc_elem = card.find('div', class_=re.compile(r'jobMetaDataGroup|job-snippet'))
                    desc_text = desc_elem.text.strip() if desc_elem else None
                    emails = self._extract_emails(desc_text) if desc_text else []
                    
                    jobs.append(ScrapedJob(
                        title=title_elem.text.strip()[:100],
                        company=company_elem.text.strip() if company_elem else "Perusahaan",
                        location=location_elem.text.strip() if location_elem else "Indonesia",
                        source="Indeed",
                        url=href.split('?')[0] if href else f"https://id.indeed.com/jobs?q={quote_plus(query)}",
                        description=desc_text[:300] if desc_text else None,
                        email=emails[0] if emails else None,
                        category=category,
                        posted_at=iso_date,
                        scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                    ))
                except Exception as e:
                    self.logger.debug(f"Indeed card parse error: {e}")
                    continue
            self._track_health("Indeed", True)
        except Exception as e:
            self.logger.warning(f"Indeed HTML error: {e}")
            self._track_health("Indeed", False)
        return jobs



    async def scrape_remoteok(self, query: str, category: str, client: httpx.AsyncClient) -> List[ScrapedJob]:
        """RemoteOK API — Public JSON API for remote jobs."""
        jobs = []
        try:
            url = f"https://remoteok.com/api?tag={quote_plus(query)}"
            headers = self._get_headers()
            headers["Accept"] = "application/json"
            res = await self._fetch_with_retry(client, url, headers=headers)
            
            if not res or res.status_code != 200:
                self._track_health("RemoteOK", False)
                return []
            
            data = res.json()
            # First item is metadata, skip it
            for item in data[1:16] if len(data) > 1 else []:
                raw_date = item.get("date", "")
                company = item.get("company", "Remote Company")
                
                iso_date = _format_date_iso(raw_date)
                if not iso_date: continue
                
                desc_text = re.sub(r'<[^>]+>', ' ', item.get("description", "")) if item.get("description") else ""
                emails = self._extract_emails(desc_text)
                
                jobs.append(ScrapedJob(
                    title=item.get("position", "Unknown"),
                    company=company,
                    location="Remote",
                    source="RemoteOK",
                    url=item.get("url", f"https://remoteok.com"),
                    description=desc_text[:300] if desc_text else None,
                    email=emails[0] if emails else None,
                    image_url=item.get("company_logo"),
                    category=category,
                    posted_at=iso_date,
                    scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                ))
            self._track_health("RemoteOK", True)
        except Exception as e:
            self.logger.warning(f"RemoteOK error: {e}")
            self._track_health("RemoteOK", False)
        return jobs
    @staticmethod
    def _parse_last_update(soup) -> Optional[datetime]:
        """Extract the 'Last Update' date from Disnakerja article pages."""
        MONTHS_EN = {'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,'july':7,'august':8,'september':9,'october':10,'november':11,'december':12}
        MONTHS_ID = {'januari':1,'februari':2,'maret':3,'april':4,'mei':5,'juni':6,'juli':7,'agustus':8,'september':9,'oktober':10,'november':11,'desember':12}
        ALL_MONTHS = {**MONTHS_EN, **MONTHS_ID}
        
        page_text = soup.get_text()
        # Match patterns like "Last Update: August 4, 2025" or "Last Update: 4 Agustus 2025"
        match = re.search(r'Last\s*Update\s*[:\-]\s*(.+?)(?:\n|$)', page_text, re.IGNORECASE)
        if not match:
            return None
        
        date_str = match.group(1).strip()
        
        # Pattern 1: "Month Day, Year" (e.g. "August 4, 2025")
        m = re.match(r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if m:
            month_name, day, year = m.group(1).lower(), int(m.group(2)), int(m.group(3))
            if month_name in ALL_MONTHS:
                return datetime(year, ALL_MONTHS[month_name], day)
        
        # Pattern 2: "Day Month Year" (e.g. "4 Agustus 2025")
        m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})', date_str)
        if m:
            day, month_name, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
            if month_name in ALL_MONTHS:
                return datetime(year, ALL_MONTHS[month_name], day)
        
        return None

    async def _fetch_disnakerja_detail(self, client: httpx.AsyncClient, url: str, company: str, category: str, iso_date: str, desc_text: Optional[str], email: Optional[str]) -> List[ScrapedJob]:
        try:
            res = await self._fetch_with_retry(client, url, headers=self._get_headers())
            if not res or res.status_code != 200: return []
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Priority 1: Use "Last Update" text from the page (most reliable)
            last_update_dt = self._parse_last_update(soup)
            if last_update_dt:
                if (datetime.now() - last_update_dt).days > 28:
                    return []  # Skip jobs older than 4 weeks
                iso_date = last_update_dt.isoformat()
            else:
                # Priority 2: Fallback to <time> element
                time_elem = soup.find('time')
                if time_elem:
                    raw_date = time_elem.get('datetime', '')
                    parsed_date = _format_date_iso(raw_date)
                    if parsed_date:
                        dt = datetime.fromisoformat(parsed_date)
                        if (datetime.now() - dt).days > 28:
                            return []
                        iso_date = parsed_date
                    else:
                        return []  # Unparseable date = reject
                else:
                    return []  # No date at all = reject
                    
            content = soup.find('div', class_='entry-content')
            if not content: return []
            
            positions = set()
            
            # Smart Position Filter Rules
            scam_and_instruction_words = r'(kualifikasi|syarat|persyaratan|tugas|tanggung|jawab|info|catatan|keterangan|lokasi|location|what you|deskripsi|cara|daftar|melamar|baca juga|penempatan|description|benefit|interview|seleksi|hati-hati|penipuan|gratis|dipungut|biaya|website|klik|link|apply|tidak pernah|bekerja sama|rekrutmen|jadwal|tahapan|berkas|dokumen|lamaran|silahkan|pendaftaran|batas akhir|deadline|subject|subjek)'
            
            regions_blacklist = {
                # Provinces / Islands
                'aceh', 'sumatera', 'sumatra', 'riau', 'jambi', 'bengkulu', 'lampung', 'banten', 'jakarta', 'jawa', 
                'yogyakarta', 'jogja', 'bali', 'madura', 'nusatenggara', 'ntb', 'ntt', 'kalimantan', 'sulawesi', 
                'maluku', 'papua',
                # Cities & Regencies
                'medan', 'pekanbaru', 'batam', 'palembang', 'padang', 'bandar', 'lampung', 'serang', 'cilegon', 
                'tangerang', 'depok', 'bogor', 'bekasi', 'karawang', 'cikarang', 'bandung', 'subang', 'purwakarta', 
                'sukabumi', 'cianjur', 'garut', 'tasikmalaya', 'ciamis', 'cirebon', 'kuningan', 'majalengka', 
                'indramayu', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'kendal', 'semarang', 'demak', 
                'kudus', 'jepara', 'rembang', 'pati', 'blora', 'grobogan', 'sragen', 'karanganyar', 'wonogiri', 
                'sukoharjo', 'surakarta', 'solo', 'boyolali', 'klaten', 'sleman', 'bantul', 'kulonprogo', 'gunungkidul', 
                'magelang', 'temanggung', 'wonosobo', 'purworejo', 'kebumen', 'cilacap', 'banyumas', 'purwokerto', 
                'purbalingga', 'banjarnegara', 'ngawi', 'magetan', 'madiun', 'ponorogo', 'pacitan', 'trenggalek', 
                'tulungagung', 'blitar', 'kediri', 'nganjuk', 'bojonegoro', 'tuban', 'lamongan', 'gresik', 'sidoarjo', 
                'surabaya', 'mojokerto', 'jombang', 'pasuruan', 'probolinggo', 'lumajang', 'malang', 'batu', 
                'bondowoso', 'situbondo', 'jember', 'banyuwangi', 'denpasar', 'singaraja', 'kupang', 
                'mataram', 'pontianak', 'singkawang', 'palangkaraya', 'sampit', 'pangkalan', 'bun', 'banjarmasin', 
                'banjarbaru', 'balikpapan', 'samarinda', 'bontang', 'tarakan', 'manado', 'bitung', 'gorontalo', 
                'palu', 'poso', 'makassar', 'maros', 'gowa', 'kendari', 'baubau', 'ambon', 'ternate', 'tidore', 
                'jayapura', 'sorong', 'manokwari', 'merauke', 'timika', 'mimika',
                # Directions & Spacing Words
                'barat', 'timur', 'utara', 'selatan', 'tengah', 'tenggara', 'penempatan', 'lokasi', 'area', 'wilayah',
                'dki', 'diy', 'luar', 'negeri', 'indonesia', 'kota', 'kabupaten', 'provinsi', 'and', 'dan'
            }
            
            for s in content.find_all(['strong', 'b']):
                text = s.text.strip()
                
                # Rule 1: Length and Word Count Check (Max 6 words for a normal job title)
                if len(text) < 3 or len(text) > 70 or len(text.split()) > 6:
                    continue
                    
                # Rule 2: Anomaly Detection (Emails, Phone numbers, URLs)
                if '@' in text or re.search(r'\d{4,}', text) or re.search(r'(http|\.com|\.co\.id|www)', text.lower()):
                    continue
                    
                # Rule 3: Blacklist Check
                if re.search(scam_and_instruction_words, text.lower()):
                    continue
                
                clean_text = re.sub(r'^\d+[\.\)]\s*', '', text).strip()
                
                # Rule 4: Blacklist location titles (prevent single location matching as job)
                words = [re.sub(r'[^a-z]', '', w) for w in clean_text.lower().split()]
                words = [w for w in words if w]
                if words and all(w in regions_blacklist for w in words):
                    continue
                
                if clean_text: 
                    positions.add(clean_text)
            
            jobs = []
            for p in list(positions)[:10]:
                jobs.append(ScrapedJob(
                    title=p[:100],
                    company=company,
                    location="Indonesia",
                    source="Disnakerja",
                    url=f"{url}#{quote_plus(p[:20])}",
                    description=desc_text[:300] if desc_text else f"Lowongan {p} di {company}.",
                    email=email,
                    category=category,
                    posted_at=iso_date,
                    scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                ))
            
            # Fallback if no positions found
            if not jobs:
                jobs.append(ScrapedJob(
                    title="Karyawan / Staff",
                    company=company,
                    location="Indonesia",
                    source="Disnakerja",
                    url=url,
                    description=desc_text[:300] if desc_text else f"Lowongan di {company}.",
                    email=email,
                    category=category,
                    posted_at=iso_date,
                    scraped_at=time.strftime("%Y-%m-%d %H:%M:%S")
                ))
            return jobs
        except Exception:
            return []

    async def scrape_disnakerja(self, query: str, category: str, client: httpx.AsyncClient) -> List[ScrapedJob]:
        """Disnakerja.com — Parse WordPress search results & deep scrape positions."""
        jobs = []
        try:
            # Query pages 1 to 3 concurrently to get more articles
            async def fetch_page(page_num):
                if page_num == 1:
                    url = f"https://www.disnakerja.com/?s={quote_plus(query)}"
                else:
                    url = f"https://www.disnakerja.com/page/{page_num}/?s={quote_plus(query)}"
                res = await self._fetch_with_retry(client, url, headers=self._get_headers())
                if not res or res.status_code != 200:
                    return []
                soup = BeautifulSoup(res.text, 'html.parser')
                return soup.find_all('article')

            page_tasks = [fetch_page(p) for p in [1, 2, 3]]
            page_results = await asyncio.gather(*page_tasks, return_exceptions=True)
            
            articles = []
            for res_articles in page_results:
                if isinstance(res_articles, list):
                    articles.extend(res_articles)
            
            seen_hrefs = set()
            tasks = []
            for a in articles:
                try:
                    title_elem = a.find('h2') or a.find('h3')
                    link_elem = a.find('a', href=True)
                    time_elem = a.find('time')
                    
                    if not title_elem or not link_elem: continue
                    
                    raw_title = title_elem.text.strip()
                    href = link_elem.get('href', '').split('?')[0]
                    
                    if href in seen_hrefs:
                        continue
                    seen_hrefs.add(href)
                    
                    raw_date = time_elem.get('datetime', '') if time_elem else "Baru"
                    iso_date = _format_date_iso(raw_date)
                    if not iso_date: continue
                    
                    desc_elem = a.find('div', class_=re.compile(r'entry-content|excerpt'))
                    desc_text = desc_elem.text.strip() if desc_elem else None
                    emails = self._extract_emails(desc_text) if desc_text else []
                    
                    company = raw_title.split(" - ")[0] if " - " in raw_title else raw_title
                    
                    tasks.append(self._fetch_disnakerja_detail(client, href, company, category, iso_date, desc_text, emails[0] if emails else None))
                except Exception as e:
                    self.logger.debug(f"Disnakerja card parse error: {e}")
                    continue
            
            sem = asyncio.Semaphore(3)
            async def run_task(t):
                async with sem:
                    return await t
                    
            detail_results = await asyncio.gather(*(run_task(t) for t in tasks), return_exceptions=True)
            for res_list in detail_results:
                if isinstance(res_list, list) and res_list:
                    jobs.extend(res_list)
                    
            self._track_health("Disnakerja", True)
        except Exception as e:
            self.logger.warning(f"Disnakerja HTML error: {e}")
            self._track_health("Disnakerja", False)
        return jobs



    # ═══════════════════════════════════════════════════════════════
    #  ORCHESTRATOR
    # ═══════════════════════════════════════════════════════════════

    async def scrape_jobs(self, query: Optional[str] = None, category: str = "All") -> List[ScrapedJob]:
        """Omni-Engine v5 — All lightweight scrapers in parallel."""
        if not query:
            query = random.choice(self.CATEGORIES.get(category, ["lowongan kerja"])) if category != "All" else "lowongan kerja"
        
        self.logger.info(f"[OMNI v5] Scraping: '{query}' (Category: {category})")
        
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            # Lightweight scrapers — always run (Vercel-safe)
            lightweight_tasks = [
                self.scrape_kalibrr(query, category, client),
                self.scrape_linkedin_guest(query, category),
                self.scrape_indeed_html(query, category, client),
                self.scrape_remoteok(query, category, client),
                self.scrape_disnakerja(query, category, client),
            ]
            
            results = await asyncio.gather(*lightweight_tasks, return_exceptions=True)
            
            all_jobs = []
            for i, res in enumerate(results):
                if isinstance(res, list):
                    self.logger.info(f"  Source {i}: {len(res)} jobs")
                    all_jobs.extend(res)
                elif isinstance(res, Exception):
                    self.logger.warning(f"  Source {i} failed: {res}")
            
            # Deduplicate by URL
            seen_urls = set()
            unique_jobs = []
            for job in all_jobs:
                clean_url = job.url.split('?')[0].rstrip('/')
                if clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    unique_jobs.append(job)
            
            # Anti-Ampas Filter for Engineering
            non_tech_pattern = re.compile(r'\b(admin|sales|marketing|hrd|human resources|finance|accounting|akuntansi|kasir|teller|customer service|legal|perawat|dokter|rekrutmen|procurement|purchasing|sekretaris|driver|security|satpam)\b', re.IGNORECASE)
            
            filtered_jobs = []
            for job in unique_jobs:
                if job.category == "Engineering" and non_tech_pattern.search(job.title):
                    continue
                filtered_jobs.append(job)
            
            self.logger.info(f"[OMNI v5] Total unique filtered: {len(filtered_jobs)} jobs")
            return filtered_jobs

    async def perform_omni_scrape(self):
        """Full autonomous scrape — all categories, all sources."""
        all_jobs = []
        tasks = []
        for cat, keywords in self.CATEGORIES.items():
            # Pick 2 random keywords per category for diversity
            selected = random.sample(keywords, min(2, len(keywords)))
            for kw in selected:
                tasks.append(self.scrape_jobs(kw, cat))
        
        # Process in batches using semaphore to avoid overloading network/memory
        sem = asyncio.Semaphore(3)
        async def run_task(task):
            async with sem:
                res = await task
                await asyncio.sleep(random.uniform(1, 3))
                return res

        results = await asyncio.gather(*(run_task(t) for t in tasks), return_exceptions=True)
        
        for res in results:
            if isinstance(res, list):
                all_jobs.extend(res)
        
        # Deduplicate
        seen = set()
        unique = []
        for j in all_jobs:
            key = f"{j.url.split('?')[0].rstrip('/')}_{j.title.lower()}"
            if key not in seen:
                seen.add(key)
                unique.append(j)
        
        # Log health stats
        self.logger.info(f"[OMNI v5] Health Stats: {self.health_stats}")
        self.logger.info(f"[OMNI v5] Full scrape complete: {len(unique)} unique jobs")
        return unique

scraper_service = ScraperService()
