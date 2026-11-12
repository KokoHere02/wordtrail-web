<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, BookmarkPlus, Check, ChevronLeft, ChevronRight, History, Library, ListChecks, NotebookPen, Play, Search, Shuffle, SlidersHorizontal, Star } from 'lucide-vue-next';
import { request, errorMessage } from '../../api/http';
import SentenceNotePanel from '../../components/learning/SentenceNotePanel.vue';
import RandomSentencesDialog from '../../components/learning/RandomSentencesDialog.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import AppDialog from '../../components/ui/AppDialog.vue';
import { useSentenceManagementAccess } from '../../stores/sentenceManagementAccess';
type Tag = { id: number; category: string; name: string };
type Sentence = { id: number; englishText: string; referenceTranslation: string; explanation: string | null; source: string; sourceReference: string | null; learning: boolean; favorite: boolean; available: boolean; tags?: Tag[] };
type History = { id: number; translation: string; createdAt: string };
const route = useRoute(); const access = useSentenceManagementAccess();
const rows = ref<Sentence[]>([]), tags = ref<Tag[]>([]), scope = ref(route.query.scope === 'favorites' ? 'favorites' : 'bank'), tagId = ref(''), offset = ref(0), busy = ref(false), error = ref('');
const searchInput = ref(''), keyword = ref('');
const selected = ref<number[]>([]);
const randomOpen = ref(false), selectionNotice = ref('');
const adding = ref(false);
const detail = ref<Sentence | null>(null), history = ref<History[]>([]), historyOffset = ref(0), selectedTags = ref<number[]>([]);
const notePanel = ref<InstanceType<typeof SentenceNotePanel> | null>(null);
const detailLoading = ref(false), detailError = ref(''), tagsSaving = ref(false);
const tagsReady = ref(false);
const savedTagIds = ref<number[]>([]);
let detailRevision = 0;
const wordId = computed(() => { const n = Number(route.query.wordId); return Number.isSafeInteger(n) && n > 0 ? n : undefined; });
const tagOptions = computed(() => {
  const groups = new Map<string, Tag[]>();
  for (const tag of tags.value) {
    const category = tag.category?.trim() || '其他';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(tag);
  }
  return [{ value: '', label: '全部标签' }, ...Array.from(groups, ([group, items]) => items.map(tag => ({ value: String(tag.id), label: tag.name, group }))).flat()];
});
let loadRevision = 0;
async function load() { const revision = ++loadRevision; busy.value = true; error.value = ''; try { const result = await request<Sentence[]>('GET','/sentence-practice/sentences',undefined,{ scope: scope.value, tagId: tagId.value || undefined, wordId: wordId.value, keyword: keyword.value || undefined, offset: offset.value, limit: 50 }); if (revision === loadRevision) rows.value = result; } catch(e) { if (revision === loadRevision) error.value = errorMessage(e); } finally { if (revision === loadRevision) busy.value = false; } }
function clearSelection() { selected.value = []; selectionNotice.value = ''; }
function search() { keyword.value = searchInput.value.trim(); offset.value = 0; detail.value = null; clearSelection(); void load(); }
function selectTag(value: string) { if (tagId.value === value) return; tagId.value = value; offset.value = 0; clearSelection(); void load(); }
async function changeScope(value: string) { if (scope.value === value) return; scope.value = value; offset.value = 0; clearSelection(); await load(); }
async function learning(row: Sentence, add: boolean) { try { await request(add ? 'PUT' : 'DELETE', `/sentence-practice/learning/${row.id}`); row.learning = add; if (scope.value === 'learning' && !add) await load(); } catch(e) { error.value = errorMessage(e); } }
async function addSelected() {
  if (busy.value) return;
  busy.value = true; adding.value = true; error.value = ''; selectionNotice.value = '';
  let processed = 0, added = 0, failure = '';
  while (selected.value.length) {
    const batch = selected.value.slice(0, 100);
    try { added += await request<number>('POST', '/sentence-practice/learning/batch', { sentenceIds: batch }); selected.value = selected.value.slice(batch.length); processed += batch.length; }
    catch (e) { failure = errorMessage(e); break; }
  }
  await load(); adding.value = false;
  if (failure) error.value = `已处理 ${processed} 句，剩余 ${selected.value.length} 句待处理：${failure}`;
  else selectionNotice.value = `已处理 ${processed} 句，新增 ${added} 句到学习列表。`;
}
async function favorite(row: Sentence) { try { await request('PUT', `/sentence-practice/sentences/${row.id}/favorite`, { favorite: !row.favorite }); row.favorite = !row.favorite; if (scope.value === 'favorites' && !row.favorite) await load(); } catch(e) { error.value = errorMessage(e); } }
async function loadHistory(nextOffset = historyOffset.value) { if(!detail.value) return; const revision = detailRevision, id = detail.value.id; detailLoading.value = true; detailError.value = ''; try { const result = await request<History[]>('GET',`/sentence-practice/sentences/${id}/history`,undefined,{offset:nextOffset,limit:50}); if (revision === detailRevision) { history.value = result; historyOffset.value = nextOffset; } } catch(e) { if (revision === detailRevision) detailError.value = errorMessage(e); } finally { if (revision === detailRevision) detailLoading.value = false; } }
async function showDetail(row: Sentence) { const revision = ++detailRevision; detail.value=row; history.value=[]; historyOffset.value=0; selectedTags.value=[]; savedTagIds.value=[]; tagsReady.value=false; detailError.value=''; detailLoading.value=true; try { const [entries, rowTags] = await Promise.all([request<History[]>('GET',`/sentence-practice/sentences/${row.id}/history`,undefined,{offset:0,limit:50}), request<Tag[]>('GET',`/sentence-practice/sentences/${row.id}/tags`)]); if (revision === detailRevision) { history.value=entries; selectedTags.value=rowTags.map(t=>t.id); savedTagIds.value=[...selectedTags.value]; tagsReady.value=true; } } catch(e) { if (revision === detailRevision) detailError.value=errorMessage(e); } finally { if (revision === detailRevision) detailLoading.value=false; } }
function closeDetail() { if (notePanel.value?.saving || tagsSaving.value) return; const tagsChanged = access.canManage && [...selectedTags.value].sort().join(',') !== [...savedTagIds.value].sort().join(','); if ((notePanel.value?.hasUnsavedChanges || tagsChanged) && !window.confirm('有未保存的修改，确定关闭吗？')) return; detailRevision++; detail.value=null; }
async function saveTags() { if(!detail.value || tagsSaving.value)return; const row = detail.value, ids = [...selectedTags.value]; tagsSaving.value=true; detailError.value=''; try { await request('PUT',`/sentence-practice/sentences/${row.id}/tags`,{tagIds:ids}); row.tags = tags.value.filter(tag => ids.includes(tag.id)); savedTagIds.value=ids; } catch(e) {detailError.value=errorMessage(e);} finally {tagsSaving.value=false;} }
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
          <form class="sentence-search" role="search" @submit.prevent="search"><label class="sentence-search-field"><span class="sr-only">搜索句子</span><Search :size="18" aria-hidden="true" /><input v-model="searchInput" type="search" maxlength="100" placeholder="搜索英文句子或中文译文" /></label><button type="submit" class="btn btn-secondary">搜索</button></form>
          <div class="tag-filter"><span class="tag-filter-label"><SlidersHorizontal :size="15" aria-hidden="true" />标签</span><AppSelect :model-value="tagId" :options="tagOptions" label="筛选标签" hide-label animated searchable @update:model-value="selectTag" /></div>
        </div>
        <div class="collection-actions">
          <div class="selection-summary" role="status"><span class="selection-dot" />{{ scope === 'learning' ? '开始练习后将依次展示学习列表中的句子' : selected.length ? `已选择 ${selected.length} 句，跨页保留` : selectionNotice || '选择句子后可批量操作' }}</div>
          <div v-if="scope !== 'learning'" class="collection-buttons"><button type="button" class="btn btn-secondary collection-primary" :disabled="busy" @click="randomOpen = true"><Shuffle :size="16" aria-hidden="true" />随机选句</button><button v-if="selected.length" type="button" class="quiet-button" :disabled="busy" @click="clearSelection">清空选择</button><button class="btn btn-primary collection-primary" :disabled="!selected.length || busy" @click="addSelected"><BookmarkPlus :size="16" aria-hidden="true" />将所选句子加入学习列表（{{ selected.length }}）</button></div>
        </div>

        <div v-if="busy" class="collection-empty" role="status">{{ adding ? '正在加入学习列表…' : '正在加载句子…' }}</div>
        <div v-else-if="!rows.length" class="collection-empty"><span class="empty-icon"><Library :size="22" aria-hidden="true" /></span><strong>{{ keyword ? '没有找到匹配的句子' : '暂无句子' }}</strong><span>{{ keyword ? '试试其他关键词或筛选条件' : scope === 'learning' ? '从句子库选择想学习的句子' : scope === 'favorites' ? '收藏喜欢的句子，方便以后查看' : '换个标签看看，或稍后再来' }}</span></div>
        <div v-else class="sentence-list">
          <article v-for="row in rows" :key="row.id" class="sentence-entry" :class="{ 'is-selected': selected.includes(row.id), 'is-learning': scope === 'learning' }">
            <label v-if="scope !== 'learning'" class="sentence-check"><input v-model="selected" type="checkbox" :value="row.id" /><span class="sr-only">选择句子</span></label>
            <div class="sentence-copy"><div class="sentence-copy-top"><span v-if="!row.available" class="sentence-inactive">已停用</span><span v-else-if="row.learning" class="sentence-added"><Check :size="13" aria-hidden="true" />学习列表</span></div><div class="sentence-english-line"><span class="sentence-english" lang="en">{{ row.englishText }}</span> <ul v-if="row.tags?.length" class="sentence-entry-tags" aria-label="句子标签" tabindex="0"><li v-for="tag in row.tags" :key="tag.id">{{ tag.name }}</li></ul></div><p class="sentence-translation">{{ row.referenceTranslation }}</p></div>
            <div class="entry-actions"><button type="button" class="entry-action entry-learn" :class="{ 'is-added': row.learning }" @click="learning(row, !row.learning)"><Check v-if="row.learning" :size="15" aria-hidden="true" /><BookmarkPlus v-else :size="15" aria-hidden="true" />{{ row.learning ? '移出学习列表' : '加入学习列表' }}</button><button type="button" class="entry-action" :aria-pressed="row.favorite" @click="favorite(row)"><Star :size="15" :fill="row.favorite ? 'currentColor' : 'none'" aria-hidden="true" />{{ row.favorite ? '取消收藏' : '收藏' }}</button><button type="button" class="entry-action" @click="showDetail(row)"><History :size="15" aria-hidden="true" />历史与笔记</button></div>
          </article>
        </div>
        <div class="collection-pagination"><span>第 {{ offset / 50 + 1 }} 页</span><div><button type="button" :disabled="offset === 0 || busy" @click="offset = Math.max(0, offset - 50); load()"><ChevronLeft :size="16" aria-hidden="true" />上一页</button><button type="button" :disabled="rows.length < 50 || busy" @click="offset += 50; load()">下一页<ChevronRight :size="16" aria-hidden="true" /></button></div></div>
      </section>

      <RandomSentencesDialog v-model="randomOpen" :scope="scope" :tag-id="tagId" :word-id="wordId" :keyword="keyword" :previous-count="selected.length" @selected="ids => { selected = ids; selectionNotice = ''; }" />
      <AppDialog :model-value="!!detail" title="句子历史与笔记" panel-class="sentence-detail-dialog" @update:model-value="value => { if (!value) closeDetail(); }">
        <div v-if="detail" class="detail-panel">
          <div class="detail-heading"><div><span class="section-eyebrow">句子详情</span><h3>{{ detail.englishText }}</h3><p>{{ detail.referenceTranslation }}</p></div></div>
          <p v-if="detailError" class="workbench-error" role="alert">{{ detailError }}</p>
          <SentenceNotePanel :key="detail.id" ref="notePanel" :sentence-id="detail.id" />
          <div class="detail-history"><div class="detail-section-title"><h3>翻译历史</h3><span v-if="history.length">本页 {{ history.length }} 条</span></div><p v-if="detailLoading" class="detail-empty" role="status">正在加载记录…</p><p v-else-if="!detailError && !history.length" class="detail-empty">暂无翻译记录</p><ul v-else-if="history.length" class="history-list"><li v-for="entry in history" :key="entry.id"><time>{{ entry.createdAt.replace('T', ' ') }}</time><p>{{ entry.translation }}</p></li></ul><div class="history-pages"><button :disabled="detailLoading || historyOffset === 0" @click="loadHistory(Math.max(0, historyOffset - 50))"><ChevronLeft :size="15" aria-hidden="true" />上一页</button><button :disabled="detailLoading || history.length < 50" @click="loadHistory(historyOffset + 50)">下一页<ChevronRight :size="15" aria-hidden="true" /></button></div></div>
          <div v-if="access.canManage" class="detail-tags"><h3>句子标签</h3><div class="tag-choices"><label v-for="tag in tags" :key="tag.id"><input v-model="selectedTags" type="checkbox" :value="tag.id" :disabled="detailLoading || tagsSaving || !tagsReady" />{{ tag.name }}</label></div><button class="btn btn-secondary" :disabled="detailLoading || tagsSaving || !tagsReady" @click="saveTags">{{ tagsSaving ? '保存中…' : '保存标签' }}</button></div>
        </div>
      </AppDialog>
  </main>
</template>

<style scoped>
.sentence-workbench { margin-top: 0; }
.sentence-search { display: flex; flex: 1; align-items: center; gap: 10px; min-width: 0; max-width: 530px; }
.sentence-search-field { display: flex; flex: 1; align-items: center; gap: 9px; min-width: 0; min-height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); background: var(--surface); }
.sentence-search-field:focus-within { border-color: var(--accent); }
.sentence-search-field svg { flex: none; }
.sentence-search input { min-width: 0; width: 100%; padding: 0; border: 0; outline: none; box-shadow: none; color: var(--ink); background: transparent; font: inherit; }
.sentence-library-page .sentence-search input:focus-visible { outline: none; border: 0; box-shadow: none; }
.sentence-search button { flex: none; min-height: 40px; }
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
.sentence-collection { margin-top: 22px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
.collection-toolbar { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 24px 28px 20px; }
.tag-filter { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tag-filter-label { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 500; }
.tag-filter-label svg { color: var(--accent-strong); }
.tag-filter :deep(.app-select) { width: 190px; }
.tag-filter :deep(.app-select-trigger) { min-height: 40px; padding: 8px 12px; border-color: var(--line); border-radius: 10px; background: var(--surface); font-size: 13px; font-weight: 500; transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease; }
.tag-filter :deep(.app-select-trigger:hover), .tag-filter :deep(.app-select.is-open .app-select-trigger) { border-color: var(--checkbox-border); background: var(--hover); }
.tag-filter :deep(.app-select.is-open .app-select-trigger) { box-shadow: 0 0 0 3px var(--shadow-tint); }
.tag-filter :deep(.app-select-options) { inset-inline: auto 0; width: max(100%, 220px); max-width: min(280px, calc(100vw - 48px)); max-height: min(300px, 50vh); padding: 6px; border-radius: 12px; overscroll-behavior: contain; transform-origin: top right; }
.tag-filter :deep(.app-select-options > li) { min-height: 40px; padding: 9px 11px; border-radius: 8px; font-size: 13px; transition: background-color 140ms ease, color 140ms ease; }
.tag-filter :deep(.app-select-options > .app-select-search) { position: sticky; top: -6px; z-index: 1; padding: 4px; background: var(--surface); cursor: default; }
.tag-filter :deep(.app-select-search input) { width: 100%; min-width: 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--ink); font: inherit; outline-color: var(--focus-ring); }
.tag-filter :deep(.app-select-options > .app-select-group) { min-height: 0; margin-top: 6px; padding: 10px 11px 5px; border-top: 1px solid var(--line); border-radius: 0; color: var(--accent-strong); font-size: 12px; font-weight: 700; letter-spacing: .03em; cursor: default; }
.tag-filter :deep(.app-select-group + li[role=option]), .tag-filter :deep(li[role=option] ~ li[role=option]) { padding-left: 18px; }
.tag-filter :deep(.app-select-options > .app-select-empty) { color: var(--muted); cursor: default; }
.tag-filter :deep(.app-select-options > li[aria-selected=true]) { color: var(--accent-strong); background: var(--sage); font-weight: 600; }
.collection-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 66px; padding: 12px 28px; border-block: 1px solid var(--line); background: var(--hover); }
.selection-summary { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
.selection-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); opacity: .7; }
.collection-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; font-size: 13px; }
.collection-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
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
.sentence-english-line { min-width: 0; line-height: 1.6; }
.sentence-translation { margin: 7px 0 0; color: var(--muted); font-size: 14px; line-height: 1.65; overflow-wrap: anywhere; }
.sentence-entry-tags { display: inline-flex; vertical-align: middle; gap: 6px; max-width: 50%; margin: 0 0 0 12px; padding: 2px 0; overflow-x: auto; list-style: none; scrollbar-width: thin; }
.sentence-entry-tags li { flex: none; white-space: nowrap; padding: 3px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--hover); color: var(--muted); font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
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
.detail-panel { padding-top: 6px; }
:global(.sentence-detail-dialog) { width: min(100%, 720px); }
.detail-heading { display: flex; justify-content: space-between; gap: 16px; }
.detail-heading > div { min-width: 0; }
.section-eyebrow { color: var(--accent-strong); font-size: 12px; font-weight: 650; letter-spacing: .05em; }
.detail-heading h3 { margin: 8px 0; font-size: 19px; line-height: 1.5; overflow-wrap: anywhere; }
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
}
@media (max-width: 400px) {
  .collection-toolbar { align-items: flex-start; flex-direction: column; gap: 14px; }
  .sentence-search { width: 100%; max-width: none; }
  .tag-filter { width: 100%; }
  .tag-filter :deep(.app-select) { flex: 1; width: auto; }
  .tag-filter :deep(.app-select-options) { width: 100%; max-width: none; }
  .collection-primary { width: 100%; }
  .entry-actions { gap: 1px; }
  .entry-action { padding-inline: 7px; font-size: 12px; }
}
</style>
