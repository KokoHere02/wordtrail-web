import { http, ApiError, responseError } from './http';

// Restrict credential-bearing audio requests to documented audio resources.
export function audioPath(source: string, accent: 'US' | 'UK') {
  const base = new URL(http.defaults.baseURL || '/api', window.location.origin);
  const url = new URL(source, `${base.origin}/`);
  const prefix = base.pathname.replace(/\/$/, '');
  if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`)) throw new ApiError('音频地址不可用。', 'INVALID_AUDIO_URL');
  const path = url.pathname.slice(prefix.length);
  if (!/^\/words\/\d+\/audio$/.test(path) && !/^\/learning-batches\/\d+\/training\/items\/\d+\/audio$/.test(path) && !/^\/dictation\/batches\/\d+\/items\/\d+\/audio$/.test(path))
    throw new ApiError('音频地址不可用。', 'INVALID_AUDIO_URL');
  if ([...url.searchParams.keys()].some(key => !['accent', 'presentationId', 'modeVersion'].includes(key)))
    throw new ApiError('音频参数不可用。', 'INVALID_AUDIO_URL');
  url.searchParams.set('accent', accent);
  return `${path}?${url.searchParams}`;
}
export async function audioBlob(source: string, accent: 'US' | 'UK', signal: AbortSignal) {
  const response = await http.get<Blob>(audioPath(source, accent), { responseType: 'blob', signal });
  if (!(response.data instanceof Blob) || !String(response.headers['content-type']).toLowerCase().startsWith('audio/') || !response.data.size)
    throw await responseError(response.data, '音频暂不可用，请重试或切换学习方式。', response.status);
  return response.data;
}
export function ordinaryAudioUrl(wordId: number) {
  const base = new URL(http.defaults.baseURL || '/api', window.location.origin);
  return `${base.origin}${base.pathname.replace(/\/$/, '')}/words/${wordId}/audio`;
}
export async function exportLearningData(signal?: AbortSignal) {
  const response = await http.get<Blob>('/me/learning-data/export', { responseType: 'blob', timeout: 120000, signal });
  const blob = response.data;
  if (response.status !== 200 || !(blob instanceof Blob) || !/^application\/zip(?:;|$)/i.test(String(response.headers['content-type'])))
    throw await responseError(blob, '下载失败，服务未返回 ZIP 文件。', response.status);
  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4)
    throw new ApiError('下载文件不完整，请重新导出。', 'INVALID_EXPORT');
  // A missing end-of-central-directory indicates a truncated ZIP, even with HTTP 200.
  const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer());
  const end = tail.findIndex((v, i) => v === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6 && i + 22 + ((tail[i + 20] || 0) | ((tail[i + 21] || 0) << 8)) === tail.length);
  if (end < 0) throw new ApiError('下载文件不完整，请重新导出。', 'INVALID_EXPORT');
  const disposition = String(response.headers['content-disposition'] || '');
  const encoded = /filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i.exec(disposition)?.[1];
  let filename = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition)?.slice(1).find(Boolean)?.trim();
  if (encoded) { try { filename = decodeURIComponent(encoded.trim()); } catch { /* plain fallback */ } }
  filename = filename?.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f:*?"<>|]/g, '').trim();
  return { blob, filename: filename && /\.zip$/i.test(filename) ? filename : 'wordtrail-learning.zip' };
}
