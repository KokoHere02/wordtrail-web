<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronRight, Database, Download, LayoutGrid, LockKeyhole, Mail, Monitor, Minus, Plus, Smartphone, Target, Volume2 } from 'lucide-vue-next';
import PronunciationSettings from '../../components/learning/PronunciationSettings.vue';
import AccountSecurityView from '../auth/AccountSecurityView.vue';
import { exportLearningData } from '../../api/learningMedia';
import { downloadBlob } from '../../utils/download';
import { dailyApi } from '../../api/daily';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { LearningSettings } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { useAuthStore } from '../../stores/auth';
type SettingsSection = 'overview' | 'allocation' | 'pronunciation' | 'data' | 'security' | 'devices';
const route = useRoute(), router = useRouter(), auth = useAuthStore();
const section = ref<SettingsSection>('overview');
const sections = [
  { id: 'overview', label: '设置总览', icon: LayoutGrid },
  { id: 'allocation', label: '每日配额', icon: Target },
  { id: 'pronunciation', label: '发音与播放', icon: Volume2 },
  { id: 'data', label: '数据管理', icon: Database },
  { id: 'security', label: '账户安全', icon: LockKeyhole },
  { id: 'devices', label: '登录设备', icon: Monitor },
] as const;
function selectSection(value: SettingsSection) {
  if (section.value === value) return;
  void router.push({ path: '/settings', query: value === 'overview' ? {} : { section: value } });
}
function openSecurity(editor: 'password' | 'phone' | 'email') {
  void router.push({ path: '/settings', query: { section: 'security', editor } });
}
watch(() => route.query.section, value => {
  section.value = sections.some(item => item.id === value) ? value as SettingsSection : 'overview';
}, { immediate: true });
function navigate(event: KeyboardEvent, index: number) {
  const offset = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
  if (!offset && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : (index + offset + sections.length) % sections.length;
  const target = sections[next]!.id;
  selectSection(target);
  document.getElementById(`settings-tab-${target}`)?.focus();
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
    <header class="settings-heading"><div><h1>设置</h1><p>管理学习偏好、账户与设备</p></div><RouterLink to="/today" class="muted-link">返回今日<ChevronRight :size="15" aria-hidden="true" /></RouterLink></header>
    <div class="settings-layout">
      <nav class="settings-nav" role="tablist" aria-label="设置分类">
        <template v-for="(entry, index) in sections" :key="entry.id">
          <p v-if="entry.id === 'allocation' || entry.id === 'security'" class="settings-nav-group" role="presentation">{{ entry.id === 'allocation' ? '学习' : '账户' }}</p>
          <button :id="`settings-tab-${entry.id}`" type="button" role="tab" :aria-selected="section === entry.id" :aria-controls="entry.id === 'security' || entry.id === 'devices' ? 'settings-panel-account' : `settings-panel-${entry.id}`" :tabindex="section === entry.id ? 0 : -1" @click="selectSection(entry.id)" @keydown="navigate($event, index)"><component :is="entry.icon" :size="18" :stroke-width="1.7" aria-hidden="true" /><span>{{ entry.label }}</span></button>
        </template>
      </nav>
      <div class="settings-content">
        <section id="settings-panel-overview" v-show="section === 'overview'" role="tabpanel" aria-labelledby="settings-tab-overview" tabindex="0" class="settings-panel settings-overview">
          <div class="settings-summary">
            <h2>学习设置</h2>
            <StatePanel :loading="loading" :error="error" @retry="refresh" />
            <template v-if="data && !loading && !error">
              <div class="settings-summary-row"><Target :size="20" aria-hidden="true" /><span>优先新词</span><strong>{{ data.newWordTarget == null ? '未设置' : `${data.newWordTarget} 词` }}</strong><button type="button" @click="selectSection('allocation')">调整 <ChevronRight :size="15" /></button></div>
              <div class="settings-summary-row"><Target :size="20" aria-hidden="true" /><span>优先复习</span><strong>{{ data.reviewLimit == null ? '未设置' : `${data.reviewLimit} 词` }}</strong><button type="button" @click="selectSection('allocation')">调整 <ChevronRight :size="15" /></button></div>
            </template>
            <div class="settings-summary-row"><Volume2 :size="20" aria-hidden="true" /><span>发音与播放</span><strong class="settings-summary-description">口音、速度与播放方式</strong><button type="button" @click="selectSection('pronunciation')">管理 <ChevronRight :size="15" /></button></div>
          </div>
          <div class="settings-summary">
            <h2>账户安全与设备</h2>
            <div class="settings-summary-row"><Smartphone :size="20" aria-hidden="true" /><span>绑定手机号</span><strong>{{ auth.user?.phone ? auth.user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定' }}</strong><button type="button" @click="openSecurity('phone')">管理 <ChevronRight :size="15" /></button></div>
            <div class="settings-summary-row"><Mail :size="20" aria-hidden="true" /><span>绑定邮箱</span><strong>{{ auth.user?.email || '未绑定' }}</strong><button type="button" @click="openSecurity('email')">管理 <ChevronRight :size="15" /></button></div>
            <div class="settings-summary-row"><LockKeyhole :size="20" aria-hidden="true" /><span>登录密码</span><strong class="settings-summary-description">通过{{ auth.user?.phone ? '手机号' : '邮箱' }}验证设置</strong><button type="button" @click="openSecurity('password')">修改 <ChevronRight :size="15" /></button></div>
            <div class="settings-summary-row"><Monitor :size="20" aria-hidden="true" /><span>登录设备</span><strong class="settings-summary-description">查看并管理设备会话</strong><button type="button" @click="selectSection('devices')">管理设备 <ChevronRight :size="15" /></button></div>
          </div>
          <button class="settings-overview-export" type="button" @click="selectSection('data')"><Download :size="18" aria-hidden="true" />导出学习数据 <ChevronRight :size="15" aria-hidden="true" /></button>
        </section>
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
          </div>
        </section>
        <section id="settings-panel-account" v-show="section === 'security' || section === 'devices'" role="tabpanel" :aria-labelledby="`settings-tab-${section === 'devices' ? 'devices' : 'security'}`" tabindex="0" class="settings-panel"><AccountSecurityView :view="section === 'devices' ? 'devices' : 'security'" :editor="route.query.editor === 'password' || route.query.editor === 'phone' || route.query.editor === 'email' ? route.query.editor : undefined" /></section>
      </div>
    </div>
  </div>
</template>
