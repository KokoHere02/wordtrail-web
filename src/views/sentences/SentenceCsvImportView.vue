<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useSentenceCsvImport } from '../../composables/useSentenceCsvImport';
import SentenceNav from '../../components/learning/SentenceNav.vue';
import SentenceManagementGate from '../../components/learning/SentenceManagementGate.vue';
import AppPagination from '../../components/ui/AppPagination.vue';
const auth = useAuthStore();
const { mode, text, file, preview, pending, imported, previewing, saving, error, notice, blocked, busy, locked, allReady, canConfirm, runPreview, confirm, retry, beginNew } = useSentenceCsvImport(auth.user!.id);
const page = ref(1);
const size = 10;
const rows = computed(() => preview.value?.rows.slice((page.value - 1) * size, page.value * size) || []);
watch(preview, () => { page.value = 1; });
const statusNames = { READY: '可导入', ALREADY_EXISTS: '题库已存在', DUPLICATE_IN_FILE: '文件内重复', INVALID: '无效行' };
function selectFile(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0]; }
</script>
<template>
  <div class="wordlist-page sentence-management sentence-csv"><header class="library-heading"><h1>导入句子题库</h1><RouterLink class="muted-link" to="/sentences/manage">返回题库维护</RouterLink></header><SentenceNav active="MANAGEMENT" /><SentenceManagementGate>
    <p class="subtle-copy">UTF-8 CSV · 最多 100 行、256 KiB。只有每行均可导入时才能整批确认。</p>
    <details class="sentence-csv-help"><summary>CSV 列与格式</summary><p>必填列：<code>englishText,referenceTranslation,explanation,difficulty,source</code></p><p>可选列：<code>sourceReference,wordIds,status</code>。难度为 1～3；关联词 ID 用 | 分隔；状态为 ACTIVE / INACTIVE，留空默认启用。逗号、换行和引号需按 CSV 格式转义。</p></details>
    <form class="sentence-editor" @submit.prevent="runPreview"><fieldset :disabled="locked"><div class="category-tabs" role="group" aria-label="CSV 输入方式"><button type="button" :class="{ active: mode === 'TEXT' }" :aria-pressed="mode === 'TEXT'" @click="mode = 'TEXT'">粘贴 CSV</button><button type="button" :class="{ active: mode === 'FILE' }" :aria-pressed="mode === 'FILE'" @click="mode = 'FILE'">上传 CSV</button></div><template v-if="mode === 'TEXT'"><label for="sentence-csv-text">CSV 原文</label><textarea id="sentence-csv-text" v-model="text" rows="10" spellcheck="false" placeholder="englishText,referenceTranslation,explanation,difficulty,source" /></template><template v-else><label for="sentence-csv-file">UTF-8 CSV 文件</label><input id="sentence-csv-file" type="file" accept=".csv,text/csv" @change="selectFile" /></template><button class="btn btn-secondary" type="submit">{{ previewing ? '预览中…' : '预览匹配结果' }}</button></fieldset></form>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p><p v-if="notice" class="sentence-notice" role="status">{{ notice }}</p>
    <section v-if="preview" class="sentence-import-preview" aria-label="CSV 预览"><p class="sentence-notice">共 {{ preview.totalCount }} 行 · 可导入 {{ preview.readyCount }} · 重复 {{ preview.duplicateCount }} · 无效 {{ preview.invalidCount }}</p><article v-for="row in rows" :key="row.rowNumber" class="sentence-import-row"><div class="sentence-linked-heading"><strong>第 {{ row.rowNumber }} 行 · {{ statusNames[row.status] }}</strong><span v-if="row.existingSentenceId">已有题目 #{{ row.existingSentenceId }}</span></div><p v-if="row.englishText" lang="en" class="sentence-english">{{ row.englishText }}</p><p v-if="row.referenceTranslation">{{ row.referenceTranslation }}</p><details v-if="row.explanation"><summary>解析和来源</summary><p>{{ row.explanation }}</p><p>{{ row.source }} · {{ row.sourceReference || '无补充' }} · 难度 {{ row.difficulty }}</p><p>关联词 ID：{{ row.wordIds?.join('、') || '无' }}</p></details><p class="subtle-copy">{{ row.message }}</p></article><AppPagination :page="page" :size="size" :total="preview.totalCount" noun="行" @change="page = $event" /><p v-if="!allReady" class="inline-error">存在问题行，整批不能导入。请修改原文后重新预览，不会跳过问题行。</p><p v-else class="subtle-copy">预览尚未入库；确认时服务端会再次校验并查重。</p><button class="btn btn-primary" :disabled="!canConfirm" @click="confirm">{{ saving ? '确认中…' : '确认整批导入' }}</button></section>
    <div v-if="pending" class="sentence-notice"><p>待确认请求的原 CSV 和请求键已保留，刷新后也可重试。</p><button class="btn btn-primary" :disabled="busy || blocked" @click="retry">{{ saving ? '确认中…' : '重试原导入请求' }}</button></div>
    <p v-if="imported" class="subtle-copy">已入库题目 ID：{{ imported.sentenceIds.join('、') || '无' }}</p>
    <button v-if="pending || imported" class="muted-link" :disabled="busy" @click="beginNew">{{ pending ? '放弃原请求重试，修改导入内容' : '开始新的导入' }}</button>
  </SentenceManagementGate></div>
</template>
