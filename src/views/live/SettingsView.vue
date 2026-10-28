<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue';
import PronunciationSettings from '../../components/learning/PronunciationSettings.vue';
import { exportLearningData } from '../../api/learningMedia';
import { downloadBlob } from '../../utils/download';
import { dailyApi } from '../../api/daily';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { LearningSettings } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { dailyModeLabels } from '../../types/dailyTraining';
const { data, loading, error, load } = useResource<LearningSettings>();
const newTarget = ref(''), reviewLimit = ref('');
const total = computed(() => Number(newTarget.value) + Number(reviewLimit.value));
const exporting = ref(false), exportError = ref(''), exportNotice = ref('');
let alive = true, exportController: AbortController | undefined;
onScopeDispose(() => { alive = false; exportController?.abort(); });
async function download() {
  if (exporting.value) return;
  exporting.value = true; exportError.value = ''; exportNotice.value = ''; exportController = new AbortController();
  try {
    const file = await exportLearningData(exportController.signal);
    if (!alive) return;
    downloadBlob(file.blob, file.filename); exportNotice.value = '导出文件已下载。';
  }
  catch (e) { if (alive) exportError.value = errorMessage(e); }
  finally { if (alive) exporting.value = false; }
}
const busy = ref(false);
const formError = ref('');
const notice = ref('');
async function refresh() {
  await load(dailyApi.settings);
  if (data.value) { newTarget.value = data.value.newWordTarget == null ? '' : String(data.value.newWordTarget); reviewLimit.value = data.value.reviewLimit == null ? '' : String(data.value.reviewLimit); }
}
async function save() {
  if (busy.value || loading.value) return;
  formError.value = ''; notice.value = '';
  if (![newTarget.value, reviewLimit.value].every(v => /^[0-9]{1,3}$/.test(v) && Number(v) <= 200) || total.value < 1 || total.value > 200) {
    formError.value = '两项各填 0～200 的整数，合计为 1～200。';
    document.getElementById('new-word-target')?.focus();
    return;
  }
  busy.value = true;
  try {
    const saved = await dailyApi.allocation(Number(newTarget.value), Number(reviewLimit.value));
    data.value = saved;
    newTarget.value = String(saved.newWordTarget ?? ''); reviewLimit.value = String(saved.reviewLimit ?? '');
    notice.value = `已保存 ${saved.dailyTarget} 词，新建每日任务生效，当前任务配额不变。`;
  } catch (e) { formError.value = errorMessage(e); }
  finally { busy.value = false; }
}
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page settings-page">
    <header class="library-heading"><div><h1>学习设置</h1></div><RouterLink to="/today" class="muted-link">返回今日</RouterLink></header>
    <StatePanel :loading="loading" :error="error" @retry="refresh" />
    <form v-if="data && !loading && !error" class="wordlist-sheet settings-form" novalidate @submit.prevent="save">
      <h2>每轮优先分配</h2>
      <p v-if="data.newWordTarget == null || data.reviewLimit == null" class="subtle-copy">当前使用旧版选词策略：优先复习，再补新词。填写并保存后启用独立配额。</p>
      <label for="new-word-target">优先新词</label><input id="new-word-target" v-model="newTarget" type="number" min="0" max="200" step="1" :disabled="busy" />
      <label for="review-limit">优先复习</label><input id="review-limit" v-model="reviewLimit" type="number" min="0" max="200" step="1" :disabled="busy" />
      <p class="subtle-copy">合计目标：{{ Number.isFinite(total) ? total : '—' }} 词。新词与到期复习可互相补位，设为 0 也可补位；新设置仅对新建任务生效。</p>
      <p class="inline-error" role="alert">{{ formError }}</p><AppButton type="submit" :busy="busy">保存每日配额</AppButton>
    </form>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p>
    <p v-if="data?.preferredStudyMode" class="subtle-copy">每日学习偏好：{{ dailyModeLabels[data.preferredStudyMode === 'FOLLOW_TYPING' ? 'RECOGNITION' : data.preferredStudyMode] }}。在学习页切换方式后自动保存，下次任务沿用。</p>
    <section class="wordlist-sheet settings-form"><PronunciationSettings /></section>
    <section class="wordlist-sheet settings-form"><h2>个人学习数据</h2><p class="subtle-copy">导出 ZIP 包含本人的计划、学习记录、收藏、笔记，以及引用的单词和句子。这是数据导出，不会自动恢复到其他账号或数据库。</p><AppButton :busy="exporting" @click="download">{{ exporting ? '正在导出…' : '下载个人学习数据 ZIP' }}</AppButton><p v-if="exportError" class="inline-error" role="alert">{{ exportError }}</p><p v-if="exportNotice" class="live-notice" role="status">{{ exportNotice }}</p></section>
    <RouterLink to="/settings/security" class="btn btn-secondary">账户安全与设备</RouterLink>
  </div>
</template>
