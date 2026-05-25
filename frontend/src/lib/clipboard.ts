import axios from 'axios';
import { API_BASE_URL } from './constants';

export async function copyCVToClipboard(
  cvId: string,
  cvHistory: { id: string; name: string; size: number; filename?: string }[]
): Promise<boolean> {
  if (!cvId) return false;
  const selectedCV = cvHistory.find(cv => cv.id === cvId);
  if (!selectedCV) return false;

  try {
    const { get } = await import('idb-keyval');
    const cvBlob = await get(`cv_blob_${cvId}`);

    if (!(cvBlob instanceof Blob)) {
      return false;
    }

    const mimeType = cvBlob.type || 'application/pdf';
    const file = new File([cvBlob], selectedCV.name, { type: mimeType });

    // 1. Web Share API
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `CV - ${selectedCV.name}`,
          text: 'Silakan klik "Copy" atau pilih aplikasi email Anda.',
        });
        return true;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return false;
      }
    }

    // 2. Async Clipboard API
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const data = [new ClipboardItem({ [mimeType]: file })];
        await navigator.clipboard.write(data);
        return true;
      }
    } catch {
      // fall through
    }

    // 3. AJAX bridge
    const clipFormData = new FormData();
    clipFormData.append('file', cvBlob, selectedCV.name);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/copy-to-clipboard`, clipFormData);
      if (res.data.status === 'success') return true;
    } catch {
      // fall through
    }

    // 4. Hidden form bridge
    const LOCAL_BRIDGE_URL = `${API_BASE_URL}/api/copy-to-clipboard`;
    try {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = LOCAL_BRIDGE_URL;
      form.target = 'cv-bridge-window';
      form.enctype = 'multipart/form-data';
      form.style.display = 'none';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.name = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      form.appendChild(fileInput);
      document.body.appendChild(form);

      const bridgeWin = window.open('', 'cv-bridge-window', 'width=350,height=200,left=100,top=100');
      if (bridgeWin) {
        form.submit();
        setTimeout(() => {
          if (document.body.contains(form)) document.body.removeChild(form);
        }, 2000);
        return true;
      }
    } catch {
      // fall through
    }

    return false;
  } catch {
    return false;
  }
}
