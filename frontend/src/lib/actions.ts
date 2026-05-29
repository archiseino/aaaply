import axios from 'axios';
import { get as getDb } from 'idb-keyval';
import { API_BASE_URL } from '../lib/constants';
import { syncAppAndReload } from './sheet';
import { useApplyStore } from '../store/useApplyStore';
import { useTrackerStore } from '../store/useTrackerStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAppStore } from '../store/useAppStore';

export async function handleSend(
  method: 'outlook' | 'gmail' | 'native',
) {
  const {
    draft,
    textInput,
    clearInput,
    editingAppId,
    selectedCV,
    cvHistory,
  } = useApplyStore.getState();
  const { setApplications } = useTrackerStore.getState();
  const { notify } = useNotificationStore.getState();
  const { setActiveTab } = useAppStore.getState();

  if (!draft) return;

  const addApplication = () => {
    const newApp = {
      id: editingAppId || Date.now().toString(),
      companyName: draft.company_name || 'Perusahaan Tidak Diketahui',
      jobTitle: draft.job_title || 'Posisi Tidak Diketahui',
      hrEmail: draft.hr_email || '-',
      dateApplied: new Date().toISOString(),
      status: 'Applied' as const,
      subject: draft.subject,
      body: draft.body,
      contextText: draft.context_text || textInput,
    };
    if (editingAppId) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === editingAppId
            ? { ...newApp, dateApplied: app.dateApplied }
            : app,
        ),
      );
      useApplyStore.getState().setEditingAppId(null);
    } else {
      setApplications((prev) => [newApp, ...prev]);
    }
    clearInput();
    setActiveTab('tracker');
  };

  const getCVBlob = async (): Promise<{
    blob: Blob;
    name: string;
  } | null> => {
    if (!selectedCV) return null;
    const cvObj = cvHistory.find((cv) => cv.id === selectedCV);
    if (!cvObj) return null;
    const blob = await getDb(`cv_blob_${cvObj.id}`);
    if (blob instanceof Blob) return { blob, name: cvObj.name };
    return null;
  };

  const isGmailEnabled =
    localStorage.getItem('GMAIL_API_ENABLED') === 'true';
  const isGmailConfigured =
    localStorage.getItem('GOOGLE_CLIENT_ID') &&
    localStorage.getItem('GOOGLE_CLIENT_ID')!.length > 0;

  if (method === 'gmail' && isGmailConfigured && isGmailEnabled) {
    try {
      const cv = await getCVBlob();
      if (!cv) {
        notify(
          'File CV tidak ditemukan. Upload ulang CV di Pengaturan.',
          'error',
        );
        return;
      }
      notify('Mengirim email via Gmail...', 'info');
      const { sendGmailWithAttachment } = await import('../utils/gmailApi');
      const res = await sendGmailWithAttachment({
        to: draft.hr_email || '',
        subject: draft.subject || '',
        body: draft.body || '',
        cvBlob: cv.blob,
        cvName: cv.name,
      });
      if (res.success) {
        notify('Email berhasil dikirim via Gmail!', 'success');
        addApplication();
        syncAppAndReload(draft).catch(() => {});
      } else {
        notify(res.error || 'Gagal mengirim email Gmail.', 'error');
      }
    } catch (e: any) {
      notify('Gmail API error: ' + (e.message || 'Unknown'), 'error');
    }
    return;
  }

  const isOutlookEnabled =
    localStorage.getItem('OUTLOOK_API_ENABLED') === 'true';
  const isOutlookConfigured =
    localStorage.getItem('OUTLOOK_CLIENT_ID') &&
    localStorage.getItem('OUTLOOK_CLIENT_ID')!.length > 0;

  if (method === 'outlook' && isOutlookConfigured && isOutlookEnabled) {
    try {
      const cv = await getCVBlob();
      if (!cv) {
        notify(
          'File CV tidak ditemukan. Upload ulang CV di Pengaturan.',
          'error',
        );
        return;
      }
      notify('Mengirim email via Outlook...', 'info');
      const { sendOutlookWithAttachment } = await import('../utils/outlookApi');
      const res = await sendOutlookWithAttachment({
        to: draft.hr_email || '',
        subject: draft.subject || '',
        body: draft.body || '',
        cvBlob: cv.blob,
        cvName: cv.name,
      });
      if (res.success) {
        notify('Email berhasil dikirim via Outlook!', 'success');
        addApplication();
        syncAppAndReload(draft).catch(() => {});
      } else {
        notify(res.error || 'Gagal mengirim email Outlook.', 'error');
      }
    } catch (e: any) {
      notify('Outlook API error: ' + (e.message || 'Unknown'), 'error');
    }
    return;
  }

  const subject = encodeURIComponent(draft.subject || '');
  const body = encodeURIComponent(draft.body || '');
  const to = encodeURIComponent(draft.hr_email || '');

  if (method === 'gmail') {
    window.open(
      `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
      '_blank',
    );
    notify(
      'Gmail dibuka. Lampirkan CV secara manual atau setup Gmail API di Pengaturan.',
      'info',
    );
  } else if (method === 'outlook') {
    window.open(
      `https://outlook.live.com/owa/?path=/mail/action/compose&to=${to}&subject=${subject}&body=${body}`,
      '_blank',
    );
    notify(
      'Outlook dibuka. Lampirkan CV secara manual atau setup Outlook API di Pengaturan.',
      'info',
    );
  } else if (method === 'native') {
    window.location.href = `mailto:${draft.hr_email || ''}?subject=${subject}&body=${body}`;
    notify('Membuka aplikasi email bawaan...', 'info');
  }

  addApplication();
  syncAppAndReload(draft).catch(() => {});
}

export async function handleJobFinderApply(job: any) {
  const {
    selectedCV,
    setSelectedCV,
    setTextInput,
    setInputType,
    setDraft,
  } = useApplyStore.getState();
  const { notify } = useNotificationStore.getState();
  const { setActiveTab } = useAppStore.getState();

  const textToProcess = `Posisi: ${job.title}\nPerusahaan: ${job.company}\nURL: ${job.url}\n\n${job.description || ''}`;
  setTextInput(textToProcess);
  setInputType('text');
  setActiveTab('apply');

  const isProcessing = useApplyStore.getState().isProcessing;
  if (isProcessing) return;

  useApplyStore.getState().setIsProcessing(true);

  try {
    let cvTextStr = '';
    const storedCVs = localStorage.getItem('APPLYBOT_CVS');
    if (storedCVs) {
      try {
        const cvs = JSON.parse(storedCVs);
        const activeCV =
          cvs.find((c: any) => c.id === selectedCV) ||
          (cvs.length > 0 ? cvs[0] : null);
        if (activeCV) {
          if (activeCV.id !== selectedCV) setSelectedCV(activeCV.id);
          cvTextStr = activeCV.text || '';
        }
      } catch {}
    }

    const formData = new FormData();
    formData.append('text', textToProcess);
    formData.append('cv_text', cvTextStr || '');

    const processRes = await axios.post(
      `${API_BASE_URL}/api/process-all`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-api-key': localStorage.getItem('GEMINI_API_KEY'),
        },
      },
    );

    const fullData = processRes.data;
    setDraft({
      hr_email: job.email || fullData.hr_email || '',
      company_name: job.company || fullData.company_name,
      job_title: job.title || fullData.job_title,
      subject: fullData.subject,
      body: fullData.body,
      context_text: fullData.context_text,
      cv_text: cvTextStr,
    });
    notify('AI berhasil menganalisis loker dan membuat draf email!', 'success');
  } catch (error: any) {
    notify(
      'Gagal memproses dengan AI: ' +
        (error.response?.data?.detail || error.message),
      'error',
    );
  } finally {
    useApplyStore.getState().setIsProcessing(false);
  }
}

export function handleEditApplication(app: any) {
  const {
    selectedCV,
    cvHistory,
    setSelectedCV,
    setDraft,
    setTextInput,
    setInputType,
    setEditingAppId,
  } = useApplyStore.getState();
  const { setActiveTab } = useAppStore.getState();

  setEditingAppId(app.id);

  let cvTextFromHistory = '';
  if (selectedCV) {
    const cvItem = cvHistory.find((cv: any) => cv.id === selectedCV);
    if (cvItem?.text) cvTextFromHistory = cvItem.text;
  }
  if (!cvTextFromHistory && cvHistory.length > 0) {
    const firstWithText = cvHistory.find((cv: any) => cv.text);
    if (firstWithText) {
      cvTextFromHistory = firstWithText.text || '';
      setSelectedCV(firstWithText.id);
    }
  }

  setDraft({
    company_name: app.companyName,
    job_title: app.jobTitle,
    hr_email: app.hrEmail,
    subject: app.subject || '',
    body: app.body || '',
    context_text: app.contextText || '',
    cv_text: cvTextFromHistory,
  });

  if (app.contextText) {
    setTextInput(app.contextText);
    setInputType('text');
  }
  setActiveTab('apply');
}

export function handleContinueAfterDuplicate() {
  useApplyStore.getState().setDuplicateModal({ isOpen: false, data: null });
}


