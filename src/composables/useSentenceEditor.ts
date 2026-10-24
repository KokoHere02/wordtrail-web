import { computed, onScopeDispose, reactive, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '../api/http';
import { sentenceManagementApi, sentenceServiceError } from '../api/sentenceManagement';
import { useSentenceManagementAccess } from '../stores/sentenceManagementAccess';
import type { ManagedSentence, SentenceQuestionWrite } from '../types/sentenceManagement';
export function useSentenceEditor(id?: number) {
  const access = useSentenceManagementAccess();
  const router = useRouter();
  const form = reactive<SentenceQuestionWrite>({ englishText: '', referenceTranslation: '', explanation: '', difficulty: 1, source: '', sourceReference: null, status: 'ACTIVE', version: 0, wordIds: [] });
  const linkedWords = ref<{ wordId: number; word: string }[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const validation = ref('');
  const notice = ref('');
  const uncertain = ref(false);
  const conflict = ref(false);
  const loaded = ref(id === undefined);
  const conflictLoaded = ref(false);
  const submittedDraft = shallowRef<SentenceQuestionWrite>();
  const busy = computed(() => loading.value || saving.value);
  const locked = computed(() => busy.value || !access.canManage || !loaded.value || conflict.value || uncertain.value);
  let active = true;
  onScopeDispose(() => { active = false; });
  function apply(value: ManagedSentence) {
    Object.assign(form, { englishText: value.englishText, referenceTranslation: value.referenceTranslation, explanation: value.explanation, difficulty: value.difficulty, source: value.source, sourceReference: value.sourceReference, status: value.status, version: value.version, wordIds: value.linkedWords.map(word => word.wordId) });
    linkedWords.value = [...value.linkedWords];
    loaded.value = true;
  }
  function fail(value: unknown) {
    error.value = sentenceServiceError(value);
    if (value instanceof ApiError && (value.status === 403 || value.code === 'SENTENCE_EDITOR_REQUIRED')) access.deny();
  }
  async function reload() {
    if (busy.value || !(await access.load())) return;
    if (id === undefined) return;
    loading.value = true; loaded.value = false; error.value = '';
    try { const value = await sentenceManagementApi.question(id); if (active) { apply(value); uncertain.value = false; if (conflict.value) conflictLoaded.value = true; } }
    catch (value) { if (active) fail(value); }
    finally { if (active) loading.value = false; }
  }
  function addWord(word: { id: number; word: string }) {
    if (locked.value) return;
    if (linkedWords.value.some(value => value.wordId === word.id)) return;
    if (linkedWords.value.length >= 50) { validation.value = '最多关联 50 个不同单词。'; return; }
    linkedWords.value.push({ wordId: word.id, word: word.word }); validation.value = '';
  }
  function removeWord(wordId: number) { if (!locked.value) linkedWords.value = linkedWords.value.filter(word => word.wordId !== wordId); }
  async function save() {
    if (locked.value) return;
    validation.value = ''; error.value = ''; notice.value = '';
    const rules = [{ value: form.englishText, max: 2000, label: '英文原文' }, { value: form.referenceTranslation, max: 2000, label: '参考译文' }, { value: form.explanation, max: 4000, label: '解析' }, { value: form.source, max: 255, label: '来源说明' }];
    for (const rule of rules) { if (!rule.value.trim() || rule.value.length > rule.max) { validation.value = `${rule.label}须为 1～${rule.max} 个字符。`; return; } }
    if ((form.sourceReference?.length || 0) > 512 || ![1, 2, 3].includes(form.difficulty) || linkedWords.value.length > 50) { validation.value = '请核对来源补充、难度和关联词数量。'; return; }
    const body: SentenceQuestionWrite = { ...form, sourceReference: form.sourceReference?.trim() ? form.sourceReference : null, wordIds: linkedWords.value.map(word => word.wordId) };
    submittedDraft.value = { ...body, wordIds: [...body.wordIds] };
    saving.value = true;
    try {
      const saved = id === undefined ? await sentenceManagementApi.create(body) : await sentenceManagementApi.update(id, body);
      if (!active) return;
      apply(saved); notice.value = saved.status === 'INACTIVE' ? '已保存并停用；原练习、历史及复习安排保留。' : '题目已保存。';
      submittedDraft.value = undefined;
      if (id === undefined) await router.replace(`/sentences/manage/${saved.sentenceId}/edit`);
    } catch (value) {
      if (!active) return;
      fail(value);
      if (value instanceof ApiError && value.code === 'SENTENCE_VERSION_CONFLICT' && id !== undefined) {
        conflict.value = true;
        loaded.value = false; conflictLoaded.value = false;
        try { const latest = await sentenceManagementApi.question(id); if (active) { apply(latest); conflictLoaded.value = true; error.value = '版本已变化，已加载最新题目。请对照未保存的修改，核对后再编辑。'; } }
        catch (readError) { if (active) fail(readError); }
      } else if (!(value instanceof ApiError && value.status !== undefined && value.status >= 400 && value.status < 500)) {
        uncertain.value = true;
        error.value += id === undefined ? '；新建结果尚未确认，请先查看管理列表，勿重复新建。' : '；保存结果尚未确认，请重新加载题目核对，勿重复保存。';
      }
    } finally { if (active) saving.value = false; }
  }
  return { access, form, linkedWords, loading, saving, error, validation, notice, uncertain, conflict, conflictLoaded, submittedDraft, busy, locked, reload, save, addWord, removeWord };
}
