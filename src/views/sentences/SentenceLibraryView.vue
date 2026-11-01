<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, BookmarkPlus, Check, ChevronLeft, ChevronRight, History, Layers3, Library, ListChecks, NotebookPen, Play, SlidersHorizontal, Star, X } from 'lucide-vue-next';
import { request, errorMessage } from '../../api/http';
import SentenceNotePanel from '../../components/learning/SentenceNotePanel.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import { useSentenceManagementAccess } from '../../stores/sentenceManagementAccess';
type Tag = { id: number; category: string; name: string };
type Sentence = { id: number; englishText: string; referenceTranslation: string; explanation: string | null; source: string; sourceReference: string | null; learning: boolean; favorite: boolean; available: boolean };
type History = { id: number; translation: string; createdAt: string };
const route = useRoute(); const access = useSentenceManagementAccess();
const rows = ref<Sentence[]>([]), tags = ref<Tag[]>([]), scope = ref(route.query.scope === 'favorites' ? 'favorites' : 'bank'), tagId = ref(''), offset = ref(0), busy = ref(false), error = ref('');
const selected = ref<number[]>([]);
const detail = ref<Sentence | null>(null), history = ref<History[]>([]), historyOffset = ref(0), selectedTags = ref<number[]>([]);
const detailPanel = ref<HTMLElement | null>(null);
const wordId = computed(() => { const n = Number(route.query.wordId); return Number.isSafeInteger(n) && n > 0 ? n : undefined; });
const tagOptions = computed(() => [{ value: '', label: '全部标签' }, ...tags.value.map(tag => ({ value: String(tag.id), label: `${tag.category} · ${tag.name}` }))]);
let loadRevision = 0;
async function load() { const revision = ++loadRevision; busy.value = true; error.value = ''; try { const result = await request<Sentence[]>('GET','/sentence-practice/sentences',undefined,{ scope: scope.value, tagId: tagId.value || undefined, wordId: wordId.value, offset: offset.value, limit: 50 }); if (revision === loadRevision) { rows.value = result; selected.value = []; } } catch(e) { if (revision === loadRevision) error.value = errorMessage(e); } finally { if (revision === loadRevision) busy.value = false; } }
function selectTag(value: string) { if (tagId.value === value) return; tagId.value = value; offset.value = 0; void load(); }
async function changeScope(value: string) { scope.value = value; offset.value = 0; await load(); }
async function learning(row: Sentence, add: boolean) { try { await request(add ? 'PUT' : 'DELETE', `/sentence-practice/learning/${row.id}`); row.learning = add; if (scope.value === 'learning' && !add) await load(); } catch(e) { error.value = errorMessage(e); } }
async function addSelected() { busy.value=true; error.value=''; try { for(const id of selected.value) await request('PUT', `/sentence-practice/learning/${id}`); await load(); } catch(e) { const message=errorMessage(e); await load(); error.value=message; } finally { busy.value=false; } }
async function favorite(row: Sentence) { try { await request('PUT', `/sentence-practice/sentences/${row.id}/favorite`, { favorite: !row.favorite }); row.favorite = !row.favorite; if (scope.value === 'favorites' && !row.favorite) await load(); } catch(e) { error.value = errorMessage(e); } }
async function loadHistory() { if(!detail.value) return; history.value=await request<History[]>('GET',`/sentence-practice/sentences/${detail.value.id}/history`,undefined,{offset:historyOffset.value,limit:50}); }
async function showDetail(row: Sentence) { detail.value=row; historyOffset.value=0; error.value=''; await nextTick(); detailPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }); try { [history.value,selectedTags.value] = await Promise.all([request<History[]>('GET',`/sentence-practice/sentences/${row.id}/history`,undefined,{offset:0,limit:50}), request<Tag[]>('GET',`/sentence-practice/sentences/${row.id}/tags`).then(v=>v.map(t=>t.id))]); } catch(e) {error.value=errorMessage(e);} }
async function saveTags() { if(!detail.value)return; try { await request('PUT',`/sentence-practice/sentences/${detail.value.id}/tags`,{tagIds:selectedTags.value}); } catch(e) {error.value=errorMessage(e);} }
onMounted(async () => { try { tags.value=await request<Tag[]>('GET','/sentence-practice/tags'); await access.load(); await load(); } catch(e) { error.value=errorMessage(e); } });
</script>
<template>
  <main class="sentence-library-page sentence-workbench">
    <p v-if="error" role="alert" class="workbench-error">{{ error }}</p>

      <div class="workbench-controls">
        <nav class="workbench-tabs" aria-label="句子范围">
          <button type="button" :class="{ active: scope === 'bank' }" :aria-pressed="scope === 'bank'" @click="changeScope('bank')"><Library :size="17" aria-hidden="true" />句子库</button>
          <button type="button" :class="{ active: scope === 'learning' }" :aria-pressed="scope === 'learning'" @click="changeScope('learning')"><ListChecks :size="17" aria-hidden="true" />学习列表</button>
          <button type="button" :class="{ active: scope === 'favorites' }" :aria-pressed="scope === 'favorites'" @click="changeScope('favorites')"><Star :size="17" aria-hidden="true" />收藏</button>
        </nav>
        <div class="workbench-shortcuts"><RouterLink to="/sentences/notes"><NotebookPen :size="16" aria-hidden="true" />个人笔记</RouterLink><RouterLink v-if="access.canManage" to="/sentences/manage"><SlidersHorizontal :size="16" aria-hidden="true" />题库维护</RouterLink><RouterLink to="/learn?mode=sentences" class="btn btn-primary workbench-start"><Play :size="15" aria-hidden="true" />开始练习</RouterLink></div>
      </div>

      <div v-if="wordId" class="word-context"><span>正在查看关联句子</span><RouterLink to="/sentences">查看全部 <ArrowRight :size="14" aria-hidden="true" /></RouterLink></div>

      <section class="sentence-collection" aria-label="句子列表">
        <div class="collection-toolbar">
          <div class="collection-heading"><span class="collection-icon"><Layers3 :size="18" aria-hidden="true" /></span><div><h2>{{ scope === 'learning' ? '待学习的句子' : scope === 'favorites' ? '收藏的句子' : '全部句子' }}</h2><p>本页 {{ rows.length }} 句<span v-if="scope !== 'learning' && selected.length"> · 已选 {{ selected.length }} 句</span></p></div></div>
          <div class="tag-filter"><span class="tag-filter-label"><SlidersHorizontal :size="15" aria-hidden="true" />标签</span><AppSelect :model-value="tagId" :options="tagOptions" label="筛选标签" hide-label animated @update:model-value="selectTag" /></div>
        </div>
        <div class="collection-actions">
          <div class="selection-summary"><span class="selection-dot" />{{ scope === 'learning' ? '开始练习后将依次展示学习列表中的句子' : selected.length ? `已选择 ${selected.length} 句` : '选择句子后可批量操作' }}</div>
          <button v-if="scope !== 'learning'" class="btn btn-primary collection-primary" :disabled="!selected.length || busy" @click="addSelected"><BookmarkPlus :size="16" aria-hidden="true" />将所选句子加入学习列表（{{ selected.length }}）</button>
        </div>

        <div v-if="busy" class="collection-empty" role="status">正在加载句子…</div>
        <div v-else-if="!rows.length" class="collection-empty"><span class="empty-icon"><Library :size="22" aria-hidden="true" /></span><strong>暂无句子</strong><span>{{ scope === 'learning' ? '从句子库选择想学习的句子' : scope === 'favorites' ? '收藏喜欢的句子，方便以后查看' : '换个标签看看，或稍后再来' }}</span></div>
        <div v-else class="sentence-list">
          <article v-for="row in rows" :key="row.id" class="sentence-entry" :class="{ 'is-selected': selected.includes(row.id), 'is-learning': scope === 'learning' }">
            <label v-if="scope !== 'learning'" class="sentence-check"><input v-model="selected" type="checkbox" :value="row.id" /><span class="sr-only">选择句子</span></label>
            <div class="sentence-copy"><div class="sentence-copy-top"><span v-if="!row.available" class="sentence-inactive">已停用</span><span v-else-if="row.learning" class="sentence-added"><Check :size="13" aria-hidden="true" />学习列表</span></div><p class="sentence-english" lang="en">{{ row.englishText }}</p><p class="sentence-translation">{{ row.referenceTranslation }}</p></div>
            <div class="entry-actions"><button type="button" class="entry-action entry-learn" :class="{ 'is-added': row.learning }" @click="learning(row, !row.learning)"><Check v-if="row.learning" :size="15" aria-hidden="true" /><BookmarkPlus v-else :size="15" aria-hidden="true" />{{ row.learning ? '移出学习列表' : '加入学习列表' }}</button><button type="button" class="entry-action" :aria-pressed="row.favorite" @click="favorite(row)"><Star :size="15" :fill="row.favorite ? 'currentColor' : 'none'" aria-hidden="true" />{{ row.favorite ? '取消收藏' : '收藏' }}</button><button type="button" class="entry-action" @click="showDetail(row)"><History :size="15" aria-hidden="true" />历史与笔记</button></div>
          </article>
        </div>
        <div class="collection-pagination"><span>第 {{ offset / 50 + 1 }} 页</span><div><button type="button" :disabled="offset === 0 || busy" @click="offset = Math.max(0, offset - 50); load()"><ChevronLeft :size="16" aria-hidden="true" />上一页</button><button type="button" :disabled="rows.length < 50 || busy" @click="offset += 50; load()">下一页<ChevronRight :size="16" aria-hidden="true" /></button></div></div>
      </section>

      <section v-if="detail" ref="detailPanel" class="detail-panel" aria-label="句子历史与笔记">
        <div class="detail-heading"><div><span class="section-eyebrow">句子详情</span><h2>{{ detail.englishText }}</h2><p>{{ detail.referenceTranslation }}</p></div><button type="button" class="quiet-button" @click="detail = null"><X :size="16" aria-hidden="true" />关闭详情</button></div>
        <div class="detail-history"><div class="detail-section-title"><h3>翻译历史</h3><span v-if="history.length">本页 {{ history.length }} 条</span></div><p v-if="!history.length" class="detail-empty">暂无翻译记录</p><ul v-else class="history-list"><li v-for="entry in history" :key="entry.id"><time>{{ entry.createdAt.replace('T', ' ') }}</time><p>{{ entry.translation }}</p></li></ul><div class="history-pages"><button :disabled="historyOffset === 0" @click="historyOffset = Math.max(0, historyOffset - 50); loadHistory()"><ChevronLeft :size="15" aria-hidden="true" />上一页</button><button :disabled="history.length < 50" @click="historyOffset += 50; loadHistory()">下一页<ChevronRight :size="15" aria-hidden="true" /></button></div></div>
        <SentenceNotePanel :key="detail.id" :sentence-id="detail.id" />
        <div v-if="access.canManage" class="detail-tags"><h3>句子标签</h3><div class="tag-choices"><label v-for="tag in tags" :key="tag.id"><input v-model="selectedTags" type="checkbox" :value="tag.id" />{{ tag.name }}</label></div><button class="btn btn-secondary" @click="saveTags">保存标签</button></div>
      </section>
  </main>
</template>

<style scoped>
.sentence-workbench { margin-top: 0; }
.workbench-error { margin: 0 0 16px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; color: var(--danger, #b64a4a); background: var(--surface); }
.workbench-controls { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 9px 16px; border: 1px solid var(--line); border-radius: 0 0 var(--radius-lg) var(--radius-lg); background: var(--surface); }
.workbench-tabs, .workbench-shortcuts { display: flex; align-items: center; gap: 6px; min-width: 0; }
.workbench-tabs button, .workbench-shortcuts a { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 9px 14px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: inherit; font-size: 14px; white-space: nowrap; }
.workbench-tabs button:hover, .workbench-shortcuts a:hover { background: var(--hover); color: var(--ink); }
.workbench-tabs button.active { background: var(--sage); color: var(--accent-strong); font-weight: 600; }
.workbench-shortcuts a { padding-inline: 10px; }
.workbench-shortcuts .workbench-start { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; margin-left: 8px; color: var(--on-accent); background: var(--accent); font-size: 13px; white-space: nowrap; }
.workbench-shortcuts .workbench-start:hover { color: var(--on-accent); background: var(--accent-strong); }
.word-context { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; padding: 11px 16px; border-radius: 10px; background: var(--sage); color: var(--accent-strong); font-size: 14px; }
.word-context a { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.sentence-collection, .detail-panel { margin-top: 22px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
.collection-toolbar { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 24px 28px 20px; }
.collection-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
.collection-icon { display: grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--sage); color: var(--accent-strong); }
.collection-heading h2 { margin: 0; color: var(--ink); font-size: 16px; font-weight: 650; line-height: 1.45; }
.collection-heading p { margin: 3px 0 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
.tag-filter { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tag-filter-label { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 500; }
.tag-filter-label svg { color: var(--accent-strong); }
.tag-filter :deep(.app-select) { width: 190px; }
.tag-filter :deep(.app-select-trigger) { min-height: 40px; padding: 8px 12px; border-color: var(--line); border-radius: 10px; background: var(--surface); font-size: 13px; font-weight: 500; transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease; }
.tag-filter :deep(.app-select-trigger:hover), .tag-filter :deep(.app-select.is-open .app-select-trigger) { border-color: var(--checkbox-border); background: var(--hover); }
.tag-filter :deep(.app-select.is-open .app-select-trigger) { box-shadow: 0 0 0 3px var(--shadow-tint); }
.tag-filter :deep(.app-select-options) { inset-inline: auto 0; width: max(100%, 220px); max-width: min(280px, calc(100vw - 48px)); max-height: min(300px, 50vh); padding: 6px; border-radius: 12px; overscroll-behavior: contain; transform-origin: top right; }
.tag-filter :deep(.app-select-options > li) { min-height: 40px; padding: 9px 11px; border-radius: 8px; font-size: 13px; transition: background-color 140ms ease, color 140ms ease; }
.tag-filter :deep(.app-select-options > li[aria-selected=true]) { color: var(--accent-strong); background: var(--sage); font-weight: 600; }
.tag-filter :deep(.app-select-pop-enter-active), .tag-filter :deep(.app-select-pop-leave-active) { transition: opacity 160ms ease, transform 160ms ease; }
.tag-filter :deep(.app-select-pop-enter-from), .tag-filter :deep(.app-select-pop-leave-to) { opacity: 0; transform: translateY(-5px) scale(.98); }
.collection-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 66px; padding: 12px 28px; border-block: 1px solid var(--line); background: var(--hover); }
.selection-summary { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.selection-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); opacity: .7; }
.collection-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; font-size: 13px; }
.sentence-list { padding: 0 28px; }
.sentence-entry { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: start; gap: 14px; padding: 23px 0; border-bottom: 1px solid var(--line); }
.sentence-entry:last-child { border-bottom: 0; }
.sentence-entry.is-learning { grid-template-columns: minmax(0, 1fr) auto; }
.sentence-check { display: grid; place-items: center; width: 24px; min-height: 30px; cursor: pointer; }
.sentence-check input { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.sentence-copy { min-width: 0; }
.sentence-copy-top:empty { display: none; }
.sentence-added, .sentence-inactive { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 7px; color: var(--accent-strong); font-size: 12px; }
.sentence-inactive { color: var(--muted); }
.sentence-workbench .sentence-english { margin: 0; color: var(--ink); font-size: 17px; font-weight: 550; line-height: 1.6; overflow-wrap: anywhere; }
.sentence-translation { margin: 7px 0 0; color: var(--muted); font-size: 14px; line-height: 1.65; overflow-wrap: anywhere; }
.entry-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 340px; }
.entry-action, .quiet-button, .collection-pagination button, .history-pages button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 9px; border: 0; border-radius: 8px; color: var(--muted); background: transparent; font: inherit; font-size: 13px; white-space: nowrap; }
.entry-action:hover, .quiet-button:hover, .collection-pagination button:hover:not(:disabled), .history-pages button:hover:not(:disabled) { color: var(--accent-strong); background: var(--hover); }
.entry-action[aria-pressed="true"], .entry-action.is-added { color: var(--accent-strong); }
.entry-action svg, .workbench-tabs svg, .workbench-shortcuts svg { flex: none; }
.collection-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 235px; justify-content: center; padding: 30px; color: var(--muted); text-align: center; font-size: 13px; }
.collection-empty strong { margin-top: 5px; color: var(--ink); font-size: 15px; }
.empty-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; color: var(--accent-strong); background: var(--sage); }
.collection-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 62px; padding: 10px 28px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
.collection-pagination > div, .history-pages { display: flex; align-items: center; gap: 4px; }
.collection-pagination button:disabled, .history-pages button:disabled { opacity: .4; cursor: not-allowed; }
.detail-panel { padding: 26px 28px; }
.detail-heading { display: flex; justify-content: space-between; gap: 16px; }
.detail-heading > div { min-width: 0; }
.section-eyebrow { color: var(--accent-strong); font-size: 12px; font-weight: 650; letter-spacing: .05em; }
.detail-heading h2 { margin: 8px 0; font-size: 19px; line-height: 1.5; overflow-wrap: anywhere; }
.detail-heading p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
.detail-heading .quiet-button { align-self: flex-start; }
.detail-history { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line); }
.detail-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.detail-section-title h3, .detail-tags h3 { margin: 0; font-size: 15px; }
.detail-section-title span, .detail-empty { color: var(--muted); font-size: 13px; }
.history-list { display: grid; gap: 10px; padding: 0; margin: 14px 0; list-style: none; }
.history-list li { padding: 12px 14px; border-radius: 9px; background: var(--hover); }
.history-list time { color: var(--muted); font-size: 12px; }
.history-list p { margin: 5px 0 0; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.history-pages { justify-content: flex-end; }
.detail-tags { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line); }
.tag-choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
.tag-choices label { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
.tag-choices input { accent-color: var(--accent); }
@media (max-width: 900px) {
  .sentence-entry { grid-template-columns: 24px minmax(0, 1fr); }
  .entry-actions { grid-column: 2; justify-content: flex-start; max-width: none; margin-left: -9px; }
  .sentence-entry.is-learning { grid-template-columns: minmax(0, 1fr); }
  .sentence-entry.is-learning .entry-actions { grid-column: 1; }
}
@media (max-width: 700px) {
  .workbench-controls { align-items: stretch; flex-direction: column; gap: 4px; padding: 8px 10px; }
  .workbench-tabs { overflow-x: auto; }
  .workbench-tabs button { padding-inline: 11px; }
  .workbench-shortcuts { flex-wrap: wrap; padding-top: 5px; border-top: 1px solid var(--line); }
  .workbench-shortcuts .workbench-start { margin-left: auto; }
  .collection-toolbar { padding: 20px 18px; }
  .collection-actions { align-items: flex-start; flex-direction: column; padding: 14px 18px; }
  .sentence-list { padding: 0 18px; }
  .sentence-entry { gap: 10px; padding-block: 20px; }
  .collection-pagination { padding-inline: 18px; }
  .detail-panel { padding: 22px 18px; }
  .detail-heading { flex-direction: column-reverse; }
  .detail-heading .quiet-button { align-self: flex-end; }
}
@media (max-width: 400px) {
  .collection-toolbar { align-items: flex-start; flex-direction: column; gap: 14px; }
  .tag-filter { width: 100%; }
  .tag-filter :deep(.app-select) { flex: 1; width: auto; }
  .tag-filter :deep(.app-select-options) { width: 100%; max-width: none; }
  .collection-primary { width: 100%; }
  .entry-actions { gap: 1px; }
  .entry-action { padding-inline: 7px; font-size: 12px; }
}
</style>
