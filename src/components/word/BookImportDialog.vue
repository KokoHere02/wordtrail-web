<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBookImport } from '../../composables/useBookImport';
import type { BookWordsChange } from '../../types/api';
import type { BookImportPreview, BookImportStatus } from '../../types/bookTransfer';
import AppDialog from '../ui/AppDialog.vue';
import AppButton from '../ui/AppButton.vue';
import AppPagination from '../ui/AppPagination.vue';
import AppSelect from '../ui/AppSelect.vue';
import ImportCandidates from './ImportCandidates.vue';
import WordMeaning from './WordMeaning.vue';
const props = defineProps<{ modelValue: boolean; bookId: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; imported: [result: BookWordsChange, skipped: number, duplicates: number]; unavailable: [] }>();
const transfer = useBookImport(props.bookId);
const formatOptions: { value: 'TXT' | 'CSV'; label: string }[] = [{ value: 'TXT', label: 'TXT · 每行一个单词或短语' }, { value: 'CSV', label: 'CSV · 含 word 表头' }];
const { mode, format, text, file, preview, selections, skipConfirmed, previewing, saving, busy, error, saveError, blocked, unresolved, wordIds, canConfirm } = transfer;
const page = ref(1);
const size = 10;
const rows = computed(() => preview.value?.records.slice((page.value - 1) * size, page.value * size) || []);
const statuses: { status: BookImportStatus; label: string; count: keyof Pick<BookImportPreview, 'matchedCount' | 'alreadyInBookCount' | 'duplicateCount' | 'notFoundCount' | 'ambiguousCount' | 'invalidCount'> }[] = [
  { status: 'MATCHED', label: '匹配成功', count: 'matchedCount' },
  { status: 'ALREADY_IN_BOOK', label: '已收录', count: 'alreadyInBookCount' },
  { status: 'DUPLICATE', label: '重复', count: 'duplicateCount' },
  { status: 'NOT_FOUND', label: '未匹配', count: 'notFoundCount' },
  { status: 'AMBIGUOUS', label: '多候选', count: 'ambiguousCount' },
  { status: 'INVALID', label: '非法行', count: 'invalidCount' },
];
watch(preview, () => { page.value = 1; });
watch(blocked, value => { if (value) emit('unavailable'); });
function close(value: boolean) { if (!busy.value) emit('update:modelValue', value); }
function upload(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0]; }
async function confirm() {
  const saved = await transfer.confirm();
  if (saved) { emit('imported', saved.result, saved.skipped, saved.duplicates); emit('update:modelValue', false); }
}
</script>
<template>
  <AppDialog :model-value="modelValue" title="批量导入词本" description="仅收录词库已有单词，不自动加入学习计划。" @update:model-value="close">
    <div class="book-import">
      <form class="import-form" :aria-busy="previewing" @submit.prevent="transfer.runPreview">
        <fieldset class="import-mode" :disabled="busy || blocked"><legend class="sr-only">导入方式</legend><label><input v-model="mode" type="radio" value="TEXT" />粘贴内容</label><label><input v-model="mode" type="radio" value="FILE" />上传文件</label></fieldset>
        <template v-if="mode === 'TEXT'">
          <AppSelect v-model="format" class="import-format" label="内容格式" :options="formatOptions" :disabled="busy || blocked" animated />
          <label class="import-text-label" for="import-text">单词内容</label><textarea id="import-text" v-model="text" rows="6" :disabled="busy || blocked" spellcheck="false" :placeholder="format === 'TXT' ? 'apple\ntake off' : 'word,phonetic,translation\napple,,苹果'" aria-describedby="import-limits" />
        </template>
        <template v-else><label class="import-text-label" for="import-file">选择 UTF-8 文件</label><input id="import-file" type="file" accept=".txt,.csv" :disabled="busy || blocked" aria-describedby="import-limits" @change="upload" /><p v-if="file" class="subtle-copy">{{ file.name }}</p></template>
        <p id="import-limits" class="subtle-copy">TXT / CSV · UTF-8 · 最多 100 个非空数据行、256 KiB。CSV 其他列不覆盖音标和释义。</p>
        <p v-if="error" class="inline-error import-error" role="alert">{{ error }}</p>
        <AppButton type="submit" variant="secondary" :busy="previewing" :disabled="saving || blocked">{{ preview ? '重新预览' : '预览匹配结果' }}</AppButton>
      </form>
      <section v-if="preview" class="import-preview" aria-label="导入预览">
        <dl class="import-counts"><div v-for="entry in statuses" :key="entry.status"><dt>{{ entry.label }}</dt><dd>{{ preview[entry.count] }}</dd></div></dl>
        <p v-if="preview.ignoredBlankCount" class="subtle-copy">已忽略 {{ preview.ignoredBlankCount }} 个空白行。</p>
        <p v-if="preview.ignoredColumns.length" class="subtle-copy">忽略列：{{ preview.ignoredColumns.join('、') }}，不写入词库。</p>
        <p v-if="!preview.totalCount" class="import-empty" role="status">没有数据行，请修改内容或重新上传。</p>
        <ol v-else class="import-rows" aria-label="预览行">
          <li v-for="row in rows" :key="row.rowNumber" class="import-row" :data-row="row.rowNumber" :data-status="row.status">
            <div class="import-row-heading"><span class="subtle-copy">第 {{ row.rowNumber }} 行</span><strong lang="en">{{ row.word || row.input || '空单词' }}</strong><span :class="['import-status', { 'import-problem': ['NOT_FOUND', 'INVALID', 'AMBIGUOUS'].includes(row.status) }]">{{ statuses.find(entry => entry.status === row.status)?.label || row.status }}</span></div>
            <p class="subtle-copy">{{ row.message }}</p>
            <ImportCandidates v-if="row.status === 'AMBIGUOUS'" :book-id="bookId" :row="row" :selected="selections.get(row.rowNumber)" :disabled="busy || blocked" @select="transfer.choose(row, $event)" @unavailable="transfer.unavailable" />
            <p v-else-if="row.status === 'DUPLICATE'" class="subtle-copy">跟随第 {{ row.duplicateOfRow }} 行：{{ transfer.selectedWord(row) ? `#${transfer.selectedWord(row)!.id}` : '尚未确认，将随原行跳过' }}</p>
            <WordMeaning v-else-if="row.candidates[0]" :translation="row.candidates[0].translation" :translation-groups="row.candidates[0].translationGroups" />
          </li>
        </ol>
        <AppPagination v-if="preview.totalCount > size" :page="page" :size="size" :total="preview.totalCount" :disabled="busy || blocked" noun="行" @change="page = $event" />
        <p class="import-confirm-count" role="status">已确认 {{ wordIds.length }} 个不同单词 · 待处理 {{ unresolved.length }} 行</p>
        <label v-if="unresolved.length" class="import-skip"><input v-model="skipConfirmed" type="checkbox" :disabled="busy || blocked" />我确认跳过以上 {{ unresolved.length }} 行，仅收录已确认的 {{ wordIds.length }} 个词。</label>
        <p v-if="saveError" class="inline-error import-save-error" role="alert">{{ saveError }}</p>
        <div class="live-actions"><AppButton :busy="saving" :disabled="!canConfirm" @click="confirm">{{ saveError ? '重试收词' : '确认收录' }} {{ wordIds.length }} 词</AppButton><AppButton variant="secondary" :disabled="busy" @click="close(false)">取消</AppButton></div>
      </section>
    </div>
  </AppDialog>
</template>
