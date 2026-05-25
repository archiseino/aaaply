import { blobToBase64, textToHtml } from './shared';

const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/gmail.compose';

let tokenClient: any = null;

// Persist token in localStorage so it survives page refreshes and browser restarts.
const TOKEN_KEY = 'SOBAT_GMAIL_TOKEN';

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setStoredToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* no-op */ }
}

/**
 * Load the Google Identity Services script dynamically (cached after first load)
 */
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    // Check if script is already loading
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const check = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout loading GIS')); }, 10000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Request OAuth token from Google (popup appears only on first use per session)
 */
function requestToken(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGisScript();
      
      // Check if we already have a valid stored token — try it silently first
      const stored = getStoredToken();
      if (stored) {
        // Verify stored token is still valid with a lightweight API call
        try {
          const check = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${stored}` }
          });
          if (check.ok) {
            resolve(stored);
            return;
          }
        } catch { /* token expired, will re-request below */ }
        // Clear invalid token
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* no-op */ }
      }
      
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GMAIL_CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          setStoredToken(response.access_token);
          resolve(response.access_token);
        },
      });
      
      // '' = silent re-auth (no popup if user already granted consent before)
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Build a RFC 2822 MIME message with attachment
 */
function buildMimeMessage(
  to: string,
  from: string,
  subject: string,
  body: string,
  attachmentName: string,
  attachmentBase64: string,
  attachmentMime: string = 'application/pdf'
): string {
  const boundary = `----=_SobatApply_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // Encode subject for UTF-8 support
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  
  const fullHtml = textToHtml(body);
  
  const lines = [
    `MIME-Version: 1.0`,
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodedSubject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(fullHtml))),
    ``,
    `--${boundary}`,
    `Content-Type: ${attachmentMime}; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    attachmentBase64,
    ``,
    `--${boundary}--`,
  ];
  
  return lines.join('\r\n');
}

/**
 * Base64 to Base64URL (Gmail API format)
 */
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Check if Gmail API is configured
 */
export function isGmailApiConfigured(): boolean {
  return !!GMAIL_CLIENT_ID;
}

/**
 * Send a Gmail email with CV attachment.
 * Works on desktop & mobile.
 */
export async function sendGmailWithAttachment(opts: {
  to: string;
  subject: string;
  body: string;
  cvBlob: Blob;
  cvName: string;
}): Promise<{ success: boolean; draftUrl?: string; error?: string }> {
  
  if (!GMAIL_CLIENT_ID) {
    return { success: false, error: 'Gmail API belum dikonfigurasi. Tambahkan VITE_GMAIL_CLIENT_ID di environment.' };
  }
  
  try {
    // 1. Get OAuth token (popup only on first use per session)
    const token = await requestToken();
    
    // 2. Get user's email address for the "From" field
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!profileRes.ok) throw new Error('Gagal mendapatkan profil Gmail. Coba login ulang.');
    const profile = await profileRes.json();
    
    // 3. Convert CV blob to base64
    const cvBase64 = await blobToBase64(opts.cvBlob);
    
    // 4. Build MIME message with attachment
    const mimeMessage = buildMimeMessage(
      opts.to,
      profile.emailAddress,
      opts.subject,
      opts.body,
      opts.cvName,
      cvBase64
    );
    
    // 5. Encode entire MIME to base64url for Gmail API
    const rawMessage = base64ToBase64Url(btoa(unescape(encodeURIComponent(mimeMessage))));
    
    // 6. Send Email via Gmail API
    const sendRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });
    
    if (!sendRes.ok) {
      const err = await sendRes.json();
      throw new Error(err.error?.message || 'Gagal mengirim email Gmail');
    }
    
    return { success: true };
    
  } catch (e: any) {
    console.error('Gmail API error:', e);
    // If token expired, reset it so next attempt will re-authenticate
    if (e.message?.includes('401') || e.message?.includes('token')) {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* no-op */ }
    }
    return { success: false, error: e.message || 'Gagal mengirim email Gmail' };
  }
}
