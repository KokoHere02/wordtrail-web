import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { api } from '../api';
import { ApiError, errorMessage } from '../api/http';
import { bookTransferApi, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '../api/bookTransfer';
import type { BookWordsChange, DictionaryWord } from '../types/api';
import type { BookImportFormat, BookImportPreview, BookImportRow } from '../types/bookTransfer';

export function useBookImport(bookId: number) {
  const mode = ref<'TEXT' | 'FILE'>('TEXT');
  const format = ref<BookImportFormat>('TXT');
  const text = ref('');
  const file = shallowRef<File>();
  const preview = shallowRef<BookImportPreview>();
  const selections = ref(new Map<number, DictionaryWord>());
  const skipConfirmed = ref(false);
  const previewing = ref(false);
  const saving = ref(false);
  const error = ref('');
  const saveError = ref('');
  const blocked = ref(false);
  const busy = computed(() => previewing.value || saving.value);
  let generation = 0;
  let active = true;
  onScopeDispose(() => { active = false; generation++; });
  function reset() {
    generation++;
    previewing.value = false;
    preview.value = undefined; selections.value = new Map(); skipConfirmed.value = false;
    error.value = ''; saveError.value = '';
  }
  watch([mode, format, text, file], reset, { flush: 'sync' });
  function unavailable(value: unknown) {
    if (value instanceof ApiError && ['BOOK_READ_ONLY', 'BOOK_NOT_FOUND'].includes(value.code)) blocked.value = true;
  }
  function choose(row: BookImportRow, word: DictionaryWord) {
    if (busy.value || blocked.value || row.status !== 'AMBIGUOUS') return;
    selections.value.set(row.rowNumber, word);
    skipConfirmed.value = false; saveError.value = '';
  }
  function selectedWord(row: BookImportRow, visited = new Set<number>()): DictionaryWord | undefined {
    if (visited.has(row.rowNumber)) return;
    visited.add(row.rowNumber);
    if (row.status === 'MATCHED' || row.status === 'ALREADY_IN_BOOK') return row.candidates[0];
    if (row.status === 'AMBIGUOUS') return selections.value.get(row.rowNumber);
    if (row.status === 'DUPLICATE') {
      const original = preview.value?.records.find(value => value.rowNumber === row.duplicateOfRow);
      if (original) return selectedWord(original, visited);
    }
  }
  const unresolved = computed(() => preview.value?.records.filter(row => !selectedWord(row)) || []);
  const wordIds = computed(() => [...new Set(preview.value?.records.flatMap(row => {
    const word = selectedWord(row);
    return word ? [word.id] : [];
  }) || [])]);
  const canConfirm = computed(() => !!preview.value && !busy.value && !blocked.value && wordIds.value.length > 0 && wordIds.value.length <= 100 && (!unresolved.value.length || skipConfirmed.value));
  async function runPreview() {
    if (busy.value || blocked.value) return;
    reset();
    if (mode.value === 'TEXT') {
      if (!text.value.trim()) { error.value = '请粘贴单词内容。'; return; }
      if (new TextEncoder().encode(text.value).byteLength > IMPORT_MAX_BYTES) { error.value = '文本超过 256 KiB，请分批导入。'; return; }
      if (format.value === 'TXT' && text.value.split(/\r\n|\r|\n/).filter(line => line.trim()).length > IMPORT_MAX_ROWS) { error.value = '最多预览 100 个非空数据行，请分批导入。'; return; }
    } else {
      if (!file.value) { error.value = '请选择 TXT 或 CSV 文件。'; return; }
      if (!/\.(txt|csv)$/i.test(file.value.name)) { error.value = '仅支持 .txt / .csv 文件。'; return; }
      if (file.value.size > IMPORT_MAX_BYTES) { error.value = '文件超过 256 KiB，请分批导入。'; return; }
    }
    const current = generation;
    previewing.value = true;
    try {
      const result = mode.value === 'TEXT'
        ? await bookTransferApi.previewText(bookId, text.value, format.value)
        : await bookTransferApi.previewFile(bookId, file.value!);
      if (!active || current !== generation) return;
      if (result.bookId !== bookId || result.totalCount > IMPORT_MAX_ROWS || result.records.length !== result.totalCount) throw new ApiError('预览结果不完整或超过 100 行，请重新预览。', 'IMPORT_PREVIEW_INVALID');
      preview.value = result;
    } catch (value) { if (active && current === generation) { error.value = errorMessage(value); unavailable(value); } }
    finally { if (active && current === generation) previewing.value = false; }
  }
  async function confirm(): Promise<{ result: BookWordsChange; skipped: number; duplicates: number } | undefined> {
    if (!canConfirm.value || !preview.value) return;
    const ids = [...wordIds.value];
    const skipped = unresolved.value.length;
    const duplicates = preview.value.duplicateCount;
    saving.value = true; saveError.value = '';
    try {
      const result = await api.collectWords(bookId, ids);
      if (active) return { result, skipped, duplicates };
    } catch (value) { if (active) { saveError.value = errorMessage(value); unavailable(value); } }
    finally { if (active) saving.value = false; }
  }
  return { mode, format, text, file, preview, selections, skipConfirmed, previewing, saving, busy, error, saveError, blocked, unresolved, wordIds, canConfirm, selectedWord, choose, unavailable, runPreview, confirm };
}
