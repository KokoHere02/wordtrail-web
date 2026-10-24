import { http, request, responseError, ApiError } from './http';
import type { BookImportFormat, BookImportPreview } from '../types/bookTransfer';

export const IMPORT_MAX_BYTES = 256 * 1024;
export const IMPORT_MAX_ROWS = 100;
export const EXPORT_MAX_BYTES = 10 * 1024 * 1024;

function filename(disposition: string, bookId: number): string {
  const fallback = `wordtrail-book-${bookId}.csv`;
  const encoded = /filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition);
  let name = plain?.[1] ?? plain?.[2]?.trim() ?? fallback;
  if (encoded) { try { name = decodeURIComponent(encoded.trim()); } catch { /* Use the plain filename. */ } }
  name = name.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f:*?"<>|]/g, '').trim() || fallback;
  return /\.csv$/i.test(name) ? name : fallback;
}

export const bookTransferApi = {
  previewText: (bookId: number, text: string, format: BookImportFormat) =>
    request<BookImportPreview>('POST', `/word-books/${bookId}/import/preview`, { text, format }),
  previewFile: (bookId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    // Axios/browser sets multipart Content-Type and boundary.
    return request<BookImportPreview>('POST', `/word-books/${bookId}/import/preview`, form);
  },
  async exportCsv(bookId: number) {
    const response = await http.get<Blob>(`/word-books/${bookId}/export`, { responseType: 'blob' });
    const type = String(response.headers['content-type'] || '').split(';')[0]?.trim().toLowerCase();
    if (response.status !== 200 || type !== 'text/csv' || !(response.data instanceof Blob)) {
      const fallback = '导出响应不是完整 CSV，未下载文件，请重试。';
      const error = await responseError(response.data, fallback, response.status);
      throw error.code === 'OK' ? new ApiError(fallback, 'INVALID_EXPORT', response.status) : error;
    }
    if (response.data.size > EXPORT_MAX_BYTES) throw new ApiError('导出超过 10 MiB，未下载文件。', 'BOOK_EXPORT_TOO_LARGE', 413);
    if (!response.data.size) throw new ApiError('导出文件为空，请重试。', 'EMPTY_EXPORT');
    return { blob: response.data, filename: filename(String(response.headers['content-disposition'] || ''), bookId) };
  },
};
