export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Revoke after the browser has consumed the click, including on failure.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
