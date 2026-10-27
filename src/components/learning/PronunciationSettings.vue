<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { usePronunciation } from '../../stores/pronunciation';
import { errorMessage } from '../../api/http';
import AppButton from '../ui/AppButton.vue';
const store = usePronunciation(), form = reactive({ ...store.value });
const busy = ref(false), error = ref(''), notice = ref('');
watch(() => store.value, value => Object.assign(form, value));
async function load() { try { await store.load(); } catch (e) { error.value = errorMessage(e); } }
async function save() {
  if (busy.value) return;
  error.value = ''; notice.value = '';
  if (!['US', 'UK'].includes(form.accent) || !Number.isFinite(form.playbackRate) || form.playbackRate < .5 || form.playbackRate > 1.5 || Math.abs(form.playbackRate * 100 - Math.round(form.playbackRate * 100)) > 1e-8 || !Number.isInteger(form.repeatCount) || form.repeatCount < 1 || form.repeatCount > 5) { error.value = '速度为 0.50～1.50（最多两位小数），重复次数为 1～5。'; return; }
  busy.value = true;
  try { await store.save({ ...form }); notice.value = '发音设置已保存。'; }
  catch (e) { error.value = errorMessage(e); }
  finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <form class="pronunciation-form" novalidate @submit.prevent="save">
    <fieldset :disabled="busy"><legend>发音设置</legend>
      <label><span>自动播放</span><input v-model="form.autoPlay" type="checkbox" /></label>
      <label><span>发音口音</span><select v-model="form.accent"><option value="US">美式 US</option><option value="UK">英式 UK</option></select></label>
      <label><span>播放速度</span><input v-model.number="form.playbackRate" type="number" min="0.5" max="1.5" step="0.05" /></label>
      <label><span>重复次数</span><input v-model.number="form.repeatCount" type="number" min="1" max="5" step="1" /></label>
    </fieldset>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p><p v-if="notice" class="subtle-copy" role="status">{{ notice }}</p>
    <AppButton type="submit" :busy="busy">保存发音设置</AppButton>
  </form>
</template>
