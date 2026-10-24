import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { ApiError } from '../api/http';
import { sentenceManagementApi, sentenceServiceError } from '../api/sentenceManagement';
import { useSentenceManagementAccess } from '../stores/sentenceManagementAccess';
import { useAuthStore } from '../stores/auth';
import type { SentenceImportPreview, SentenceImportBody, SentenceImported } from '../types/sentenceManagement';
const limit = 256 * 1024;
export function useSentenceCsvImport(userId: number) {
  const access = useSentenceManagementAccess();
  const auth = useAuthStore();
  const key = `wordtrail.sentences.import.pending.${userId}`;
  const mode = ref<'TEXT' | 'FILE'>('TEXT');
  const text = ref('');
  const file = shallowRef<File>();
  const preview = shallowRef<SentenceImportPreview>();
  const previewText = ref<string>();
  const pending = shallowRef<SentenceImportBody>();
  const imported = shallowRef<SentenceImported>();
  const previewing = ref(false);
  const saving = ref(false);
  const error = ref('');
  const notice = ref('');
  const blocked = ref(false);
  let generation = 0;
  let active = true;
  onScopeDispose(() => { active = false; generation++; });
  const busy = computed(() => previewing.value || saving.value);
  const locked = computed(() => busy.value || auth.user?.id !== userId || !access.canManage || !!pending.value || !!imported.value);
  const allReady = computed(() => !!preview.value && preview.value.totalCount > 0 && preview.value.totalCount <= 100 && preview.value.rows.length === preview.value.totalCount && preview.value.readyCount === preview.value.totalCount && preview.value.duplicateCount === 0 && preview.value.invalidCount === 0 && preview.value.rows.every(row => row.status === 'READY'));
  const canConfirm = computed(() => allReady.value && previewText.value !== undefined && !locked.value && !blocked.value);
  function resetPreview() { generation++; previewing.value = false; preview.value = undefined; previewText.value = undefined; error.value = ''; blocked.value = false; }
  watch([mode, text, file], resetPreview, { flush: 'sync' });
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string' && 'requestId' in value && typeof value.requestId === 'string') { pending.value = { text: value.text, requestId: value.requestId }; text.value = value.text; notice.value = '上次导入结果尚未确认，请原样重试。'; }
  } catch { /* Surface storage failures before confirming. */ }
  function remember(value?: SentenceImportBody) {
    if (value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { error.value = '无法保存导入请求，请允许会话存储后重试。'; return false; } }
    else { try { sessionStorage.removeItem(key); } catch { /* Safe idempotent replay if a stale entry remains. */ } }
    pending.value = value;
    return true;
  }
  function fail(value: unknown) {
    error.value = sentenceServiceError(value);
    if (value instanceof ApiError && (value.status === 403 || value.code === 'SENTENCE_EDITOR_REQUIRED')) access.deny();
  }
  async function runPreview() {
    if (locked.value || blocked.value) return;
    resetPreview();
    const current = generation;
    previewing.value = true; notice.value = '';
    try {
      let original: string;
      if (mode.value === 'TEXT') {
        original = text.value;
        if (!original.trim()) throw new ApiError('请粘贴 CSV 内容。', 'IMPORT_EMPTY');
        if (new TextEncoder().encode(original).byteLength > limit) throw new ApiError('CSV 超过 256 KiB，请分批处理。', 'IMPORT_TOO_LARGE');
      } else {
        if (!file.value) throw new ApiError('请选择 UTF-8 CSV 文件。', 'IMPORT_EMPTY');
        if (!/\.csv$/i.test(file.value.name)) throw new ApiError('仅支持 CSV 文件。', 'IMPORT_CSV_INVALID');
        if (file.value.size > limit) throw new ApiError('文件超过 256 KiB，请分批处理。', 'IMPORT_TOO_LARGE');
        try { original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.value.arrayBuffer()); }
        catch { throw new ApiError('文件必须是有效 UTF-8 编码，请重新保存后上传。', 'IMPORT_ENCODING_UNSUPPORTED'); }
      }
      if (!active || current !== generation) return;
      const data = mode.value === 'TEXT' ? await sentenceManagementApi.previewText(original) : await sentenceManagementApi.previewFile(file.value!);
      if (!active || current !== generation) return;
      if (data.totalCount > 100 || data.rows.length !== data.totalCount) throw new ApiError('预览超过 100 行或结果不完整，不能确认。', 'IMPORT_ROW_LIMIT');
      preview.value = data; previewText.value = original;
    } catch (value) { if (active && current === generation) fail(value); }
    finally { if (active && current === generation) previewing.value = false; }
  }
  async function send() {
    const body = pending.value;
    if (!body || busy.value || auth.user?.id !== userId || !access.canManage || blocked.value) return;
    saving.value = true; error.value = ''; notice.value = '';
    try {
      const result = await sentenceManagementApi.import(body);
      if (!active) return;
      remember(); imported.value = result; preview.value = undefined;
      notice.value = `已导入 ${result.importedCount} 题（导入记录 #${result.importId}）。`;
    } catch (value) {
      if (!active) return;
      fail(value);
      if (value instanceof ApiError && value.code === 'REQUEST_ID_REUSED') { blocked.value = true; error.value += '；原文和请求键已保留，请核对，不自动更换请求键。'; }
      else if (value instanceof ApiError && ['SENTENCE_IMPORT_NOT_READY', 'SENTENCE_ALREADY_EXISTS', 'SENTENCE_WORD_UNAVAILABLE', 'IMPORT_CSV_INVALID', 'IMPORT_EMPTY', 'IMPORT_ROW_LIMIT', 'IMPORT_ENCODING_UNSUPPORTED', 'IMPORT_TOO_LARGE', 'INVALID_PARAMETER'].includes(value.code)) {
        remember(); preview.value = undefined; previewText.value = undefined;
        error.value += '；整批未导入，请修改内容或重新预览。';
      } else notice.value = '结果尚未确认。原 CSV 和请求键已保留，请重试原请求。';
    } finally { if (active) saving.value = false; }
  }
  async function confirm() {
    if (!canConfirm.value || previewText.value === undefined) return;
    if (remember({ text: previewText.value, requestId: crypto.randomUUID() })) await send();
  }
  function beginNew() {
    if (busy.value) return;
    const uncertain = !!pending.value;
    remember(); imported.value = undefined; resetPreview();
    notice.value = uncertain ? '已开始新的导入内容，请先在题库核对上次结果；重新确认将使用新请求键。' : '';
  }
  return { access, mode, text, file, preview, previewText, pending, imported, previewing, saving, error, notice, blocked, busy, locked, allReady, canConfirm, runPreview, confirm, retry: send, beginNew };
}
