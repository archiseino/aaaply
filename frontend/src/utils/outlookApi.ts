import { blobToBase64, textToHtml } from './shared';

const OUTLOOK_CLIENT_ID = import.meta.env.VITE_OUTLOOK_CLIENT_ID || '';
const GRAPH_SCOPES = ['Mail.ReadWrite', 'Mail.Send'];

let msalInstance: any = null;
let msalAccount: any = null;

/**
 * Load MSAL.js from CDN dynamically (cached after first load)
 */
function loadMsalScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).msal?.PublicClientApplication) {
      resolve();
      return;
    }
    if (document.querySelector('script[src*="msal-browser"]')) {
      const check = setInterval(() => {
        if ((window as any).msal?.PublicClientApplication) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout loading MSAL')); }, 10000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Microsoft Authentication Library'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize MSAL and get access token
 */
async function getMsalToken(): Promise<string> {
  await loadMsalScript();
  
  if (!msalInstance) {
    const config = {
      auth: {
        clientId: OUTLOOK_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'localStorage', // Use localStorage so token persists across refreshes
      },
    };
    msalInstance = new (window as any).msal.PublicClientApplication(config);
    await msalInstance.initialize();
  }
  
  // Try silent token acquisition first (if user already logged in)
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalAccount = accounts[0];
    try {
      const silentResult = await msalInstance.acquireTokenSilent({
        scopes: GRAPH_SCOPES,
        account: msalAccount,
      });
      return silentResult.accessToken;
    } catch {
      // Silent failed, will try interactive below
    }
  }
  
  // Interactive login (popup — works on desktop & mobile)
  const interactiveResult = await msalInstance.acquireTokenPopup({
    scopes: GRAPH_SCOPES,
  });
  msalAccount = interactiveResult.account;
  return interactiveResult.accessToken;
}

/**
 * Check if Outlook API is configured
 */
export function isOutlookApiConfigured(): boolean {
  return !!OUTLOOK_CLIENT_ID;
}

/**
 * Send an Outlook email with CV attachment directly.
 * Works on desktop & mobile.
 */
export async function sendOutlookWithAttachment(opts: {
  to: string;
  subject: string;
  body: string;
  cvBlob: Blob;
  cvName: string;
}): Promise<{ success: boolean; draftUrl?: string; error?: string }> {
  
  if (!OUTLOOK_CLIENT_ID) {
    return { success: false, error: 'Outlook API belum dikonfigurasi. Tambahkan VITE_OUTLOOK_CLIENT_ID di environment.' };
  }
  
  try {
    // 1. Get OAuth token
    const token = await getMsalToken();
    
    // 2. Send email via Microsoft Graph API
    const cvBase64 = await blobToBase64(opts.cvBlob);
    
    // Convert plain text to HTML for proper formatting
    const fullHtml = textToHtml(opts.body);
    
    const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: opts.subject,
          body: {
            contentType: 'HTML',
            content: fullHtml,
          },
          toRecipients: [
            { emailAddress: { address: opts.to } }
          ],
          attachments: [
            {
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: opts.cvName,
              contentType: opts.cvBlob.type || 'application/pdf',
              contentBytes: cvBase64,
            }
          ]
        },
        saveToSentItems: "true"
      }),
    });
    
    if (!sendRes.ok) {
      const err = await sendRes.json();
      throw new Error(err.error?.message || 'Gagal mengirim email Outlook');
    }
    
    return { success: true };
    
  } catch (e: any) {
    console.error('Outlook API error:', e);
    // Reset on auth errors
    if (e.message?.includes('401') || e.message?.includes('token') || e.message?.includes('interaction_required')) {
      msalAccount = null;
    }
    return { success: false, error: e.message || 'Gagal membuat draft Outlook' };
  }
}
