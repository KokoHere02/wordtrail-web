import { computed, onScopeDispose, reactive, ref, shallowRef } from 'vue';
import { ApiError } from '../api/http';
import { sentenceLinksApi } from '../api/sentenceLinks';
import { sentenceServiceError } from '../api/sentenceManagement';
import type { SentenceNote, SentenceNoteWrite } from '../types/sentenceLinks';
export function useSentenceNote(sentenceId: number, initial: SentenceNote | undefined, saved: (value: SentenceNote) => void) {
  const note = shallowRef(initial);
  const form = reactive<SentenceNoteWrite>({ content: '', errorTags: [], attemptId: null, version: 0 });
  const editing = ref(false), loading = ref(false), saving = ref(false), loaded = ref(false), needsReview = ref(false);
  const error = ref(''), notice = ref('');
  const draft = shallowRef<SentenceNoteWrite>();
  const busy = computed(() => loading.value || saving.value);
  const locked = computed(() => busy.value || !loaded.value || needsReview.value);
  let active = true;
  onScopeDispose(() => { active = false; });
  function apply(value: SentenceNote) { note.value = value; Object.assign(form, { content: value.content, errorTags: [...value.errorTags], attemptId: value.attemptId, version: value.version }); loaded.value = true; }
  async function reload() {
    if (busy.value) return;
    loading.value = true; loaded.value = false; error.value = '';
    try { const value = await sentenceLinksApi.note(sentenceId); if (active) apply(value); }
    catch (value) { if (active) error.value = sentenceServiceError(value); }
    finally { if (active) loading.value = false; }
  }
  async function edit() { editing.value = true; notice.value = ''; await reload(); }
  async function save(clear = false) {
    if (locked.value) return;
    error.value = ''; notice.value = '';
    if (!clear && form.content.length > 4000) { error.value = '笔记最多 4000 个字符。'; return; }
    const body: SentenceNoteWrite = clear ? { content: '', errorTags: [], attemptId: null, version: form.version } : { ...form, errorTags: [...form.errorTags] };
    draft.value = body; saving.value = true;
    try {
      const value = await sentenceLinksApi.saveNote(sentenceId, body);
      if (active) { apply(value); saved(value); draft.value = undefined; notice.value = clear ? '笔记已清空。' : '笔记已保存。'; editing.value = false; }
    } catch (value) {
      if (!active) return;
      error.value = sentenceServiceError(value);
      const conflict = value instanceof ApiError && value.code === 'SENTENCE_NOTE_VERSION_CONFLICT';
      const unknown = !(value instanceof ApiError && value.status !== undefined && value.status >= 400 && value.status < 500);
      if (conflict || unknown) {
        needsReview.value = true; loaded.value = false;
        try { const latest = await sentenceLinksApi.note(sentenceId); if (active) { apply(latest); error.value = conflict ? '笔记已在别处修改，已读取最新版本，请核对原稿后继续。' : '保存结果尚未确认，已读取最新笔记，请核对后继续。'; } }
        catch (readError) { if (active) error.value += `；${sentenceServiceError(readError)}`; }
      }
    } finally { if (active) saving.value = false; }
  }
  return { note, form, editing, loading, saving, loaded, needsReview, error, notice, draft, busy, locked, reload, edit, save };
}
