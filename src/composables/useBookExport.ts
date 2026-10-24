import { onScopeDispose, ref } from 'vue';
import { ApiError, errorMessage } from '../api/http';
import { bookTransferApi } from '../api/bookTransfer';
import { downloadBlob } from '../utils/download';
export function useBookExport(bookId: number, unavailable: () => void) {
  const exporting = ref(false);
  const exportError = ref('');
  const exportNotice = ref('');
  let active = true;
  onScopeDispose(() => { active = false; });
  async function exportCsv() {
    if (exporting.value) return;
    exporting.value = true; exportError.value = ''; exportNotice.value = '';
    try {
      const file = await bookTransferApi.exportCsv(bookId);
      if (!active) return;
      downloadBlob(file.blob, file.filename);
      exportNotice.value = `已发起下载：${file.filename}`;
    } catch (value) {
      if (!active) return;
      exportError.value = errorMessage(value);
      if (value instanceof ApiError && ['BOOK_NOT_FOUND', 'BOOK_READ_ONLY'].includes(value.code)) unavailable();
    } finally { if (active) exporting.value = false; }
  }
  return { exporting, exportError, exportNotice, exportCsv };
}
