<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { ArrowUpRight, ChevronRight, Database, Download, Minus, Plus, Target, Volume2 } from 'lucide-vue-next';
import PronunciationSettings from '../../components/learning/PronunciationSettings.vue';
import { exportLearningData } from '../../api/learningMedia';
import { downloadBlob } from '../../utils/download';
import { dailyApi } from '../../api/daily';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { LearningSettings } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
type SettingsSection = 'allocation' | 'pronunciation' | 'data';
const section = ref<SettingsSection>('allocation');
const sections = [
  { id: 'allocation', label: '每日配额', icon: Target },
  { id: 'pronunciation', label: '发音与播放', icon: Volume2 },
  { id: 'data', label: '数据管理', icon: Database },
] as const;
function navigate(event: KeyboardEvent, index: number) {
  const offset = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
  if (!offset && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + offset + sections.length) % sections.length;
  section.value = sections[next]!.id;
  document.getElementById(`settings-tab-${section.value}`)?.focus();
}
const { data, loading, error, load } = useResource<LearningSettings>();
const newTarget = ref(''), reviewLimit = ref('');
const total = computed(() => Number(newTarget.value) + Number(reviewLimit.value));
function adjust(target: 'new' | 'review', delta: number) {
  if (busy.value || loading.value) return;
  const field = target === 'new' ? newTarget : reviewLimit;
  field.value = String(Math.max(0, Math.min(200, Math.trunc(Number(field.value) || 0) + delta)));
}
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
    notice.value = `已保存 ${saved.dailyTarget} 词，下次新建任务生效。`;
  } catch (e) { formError.value = errorMessage(e); }
  finally { busy.value = false; }
}
onMounted(refresh);
</script>
<template>
  <div class="wordlist-page settings-page">
    <header class="settings-heading"><h1>学习设置</h1><RouterLink to="/today" class="muted-link">返回今日<ChevronRight :size="15" aria-hidden="true" /></RouterLink></header>
    <div class="settings-layout">
      <nav class="settings-nav" role="tablist" aria-label="学习设置">
        <button v-for="(entry, index) in sections" :id="`settings-tab-${entry.id}`" :key="entry.id" type="button" role="tab" :aria-selected="section === entry.id" :aria-controls="`settings-panel-${entry.id}`" :tabindex="section === entry.id ? 0 : -1" @click="section = entry.id" @keydown="navigate($event, index)"><component :is="entry.icon" :size="18" :stroke-width="1.7" aria-hidden="true" /><span>{{ entry.label }}</span></button>
      </nav>
      <div class="settings-content">
        <section id="settings-panel-allocation" v-show="section === 'allocation'" role="tabpanel" aria-labelledby="settings-tab-allocation" tabindex="0" class="settings-panel">
          <header class="settings-section-heading"><h2>每轮优先分配</h2><p>新词与到期复习可互相补位，设为 0 也可补位；新设置仅对新建任务生效。</p></header>
          <StatePanel :loading="loading" :error="error" @retry="refresh" />
          <form v-if="data && !loading && !error" class="settings-card settings-allocation-form" novalidate @submit.prevent="save">
            <p v-if="data.newWordTarget == null || data.reviewLimit == null" class="settings-legacy-note">当前优先复习，保存后使用分类偏好。</p>
            <div class="settings-quota-row">
              <div class="settings-field-copy"><label for="new-word-target">优先新词</label><p id="new-word-hint">0～200 词</p></div>
              <div class="settings-stepper"><button type="button" aria-label="减少每日新词" :disabled="busy || Number(newTarget) <= 0" @click="adjust('new', -1)"><Minus :size="15" aria-hidden="true" /></button><input id="new-word-target" v-model="newTarget" type="number" min="0" max="200" step="1" inputmode="numeric" aria-describedby="new-word-hint" :aria-invalid="!!formError" :disabled="busy" /><button type="button" aria-label="增加每日新词" :disabled="busy || Number(newTarget) >= 200" @click="adjust('new', 1)"><Plus :size="15" aria-hidden="true" /></button></div>
            </div>
            <div class="settings-quota-row">
              <div class="settings-field-copy"><label for="review-limit">优先复习</label><p id="review-limit-hint">0～200 词</p></div>
              <div class="settings-stepper"><button type="button" aria-label="减少每日复习" :disabled="busy || Number(reviewLimit) <= 0" @click="adjust('review', -1)"><Minus :size="15" aria-hidden="true" /></button><input id="review-limit" v-model="reviewLimit" type="number" min="0" max="200" step="1" inputmode="numeric" aria-describedby="review-limit-hint" :aria-invalid="!!formError" :disabled="busy" /><button type="button" aria-label="增加每日复习" :disabled="busy || Number(reviewLimit) >= 200" @click="adjust('review', 1)"><Plus :size="15" aria-hidden="true" /></button></div>
            </div>
            <div class="settings-total"><span>每日目标 · 每轮配置</span><strong>{{ Number.isFinite(total) ? total : '—' }}<small>词</small></strong></div>
            <div class="settings-save-row"><p v-if="formError" id="allocation-error" class="inline-error" role="alert">{{ formError }}</p><p v-else-if="notice" class="live-notice" role="status">{{ notice }}</p><AppButton type="submit" :busy="busy">保存每日配额</AppButton></div>
          </form>
        </section>
        <section id="settings-panel-pronunciation" v-show="section === 'pronunciation'" role="tabpanel" aria-labelledby="settings-tab-pronunciation" tabindex="0" class="settings-panel settings-audio-panel">
          <header class="settings-section-heading"><h2>发音与播放</h2></header>
          <div class="settings-card"><PronunciationSettings /></div>
        </section>
        <section id="settings-panel-data" v-show="section === 'data'" role="tabpanel" aria-labelledby="settings-tab-data" tabindex="0" class="settings-panel">
          <header class="settings-section-heading"><h2>数据管理</h2></header>
          <div class="settings-card settings-data-card">
            <div class="settings-data-row"><div class="settings-field-copy"><h3>个人学习数据</h3><p>导出计划、记录、收藏、笔记及引用词句，不支持自动恢复。</p></div><AppButton :busy="exporting" aria-label="下载个人学习数据 ZIP" @click="download"><Download :size="16" aria-hidden="true" />{{ exporting ? '正在导出…' : '导出 ZIP' }}</AppButton></div>
            <p v-if="exportError" class="inline-error" role="alert">{{ exportError }}</p><p v-if="exportNotice" class="live-notice" role="status">{{ exportNotice }}</p>
            <div class="settings-data-row settings-security-row"><h3>账户安全与设备</h3><RouterLink to="/settings/security" class="muted-link">管理<ArrowUpRight :size="16" aria-hidden="true" /></RouterLink></div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
