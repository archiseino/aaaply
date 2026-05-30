export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function textToHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text.trim())) {
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">${text}</div>`;
  }
  const paragraphs = text.split(/\n\s*\n/);

  const htmlParagraphs = paragraphs.map(para => {
    const lines = para.split('\n');
    if (lines.length <= 1) {
      return `<p style="margin:0 0 1em 0;line-height:1.6">${lines[0]?.trim() || ''}</p>`;
    }

    let merged = lines[0].trim();
    for (let i = 1; i < lines.length; i++) {
      const prevLineLen = lines[i - 1].trim().length;
      const currentLine = lines[i].trim();
      if (!currentLine) continue;

      if (prevLineLen > 55) {
        merged += ' ' + currentLine;
      } else {
        merged += '<br>' + currentLine;
      }
    }

    return `<p style="margin:0 0 1em 0;line-height:1.6">${merged}</p>`;
  });

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">${htmlParagraphs.join('\n')}</div>`;
}
