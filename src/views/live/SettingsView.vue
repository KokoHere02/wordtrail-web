<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { dailyApi } from '../../api/daily';
import { errorMessage } from '../../api/http';
import { useResource } from '../../composables/useResource';
import type { LearningSettings } from '../../types/daily';
import StatePanel from '../../components/ui/StatePanel.vue';
import AppButton from '../../components/ui/AppButton.vue';
const { data, loading, error, load } = useResource<LearningSettings>();
const target = ref('');
const busy = ref(false);
const formError = ref('');
const notice = ref('');
async function refresh() {
  await load(dailyApi.settings);
  if (data.value) target.value = String(data.value.dailyTarget);
}
async function save() {
  if (busy.value || loading.value) return;
  formError.value = ''; notice.value = '';
  if (!/^[0-9]{1,3}$/.test(target.value) || Number(target.value) < 1 || Number(target.value) > 200) {
    formError.value = '请输入 1～200 的整数。';
    document.getElementById('daily-target')?.focus();
    return;
  }
  busy.value = true;
  try {
    const saved = await dailyApi.saveSettings(Number(target.value));
    data.value = saved;
    target.value = String(saved.dailyTarget);
    notice.value = `已保存 ${saved.dailyTarget} 词，新建任务生效。`;
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
      <label for="daily-target">每日目标 · 当前 {{ data.dailyTarget }} 词</label>
      <input id="daily-target" v-model="target" type="text" inputmode="numeric" maxlength="16" autocomplete="off" :disabled="busy" :aria-invalid="!!formError" aria-describedby="target-help target-error" />
      <p id="target-help" class="subtle-copy">每天 1～200 词，含新学和复习。已有任务不变。</p>
      <p id="target-error" class="inline-error" role="alert">{{ formError }}</p>
      <AppButton type="submit" :busy="busy">保存每日目标</AppButton>
    </form>
    <p v-if="notice" class="live-notice" role="status">{{ notice }}</p>
  </div>
</template>
