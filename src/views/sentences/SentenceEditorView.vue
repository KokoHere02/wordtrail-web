<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSentenceEditor } from '../../composables/useSentenceEditor';
import SentenceNav from '../../components/learning/SentenceNav.vue';
import SentenceManagementGate from '../../components/learning/SentenceManagementGate.vue';
import SentenceWordPicker from '../../components/learning/SentenceWordPicker.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import { sentenceLevelOptions, sentenceStatusOptions } from '../../utils/sentenceOptions';
const route = useRoute();
const id = route.params.sentenceId ? Number(route.params.sentenceId) : undefined;
const { form, linkedWords, loading, saving, error, validation, notice, uncertain, conflict, conflictLoaded, submittedDraft, busy, locked, reload, save, addWord, removeWord } = useSentenceEditor(id);
const picker = ref(false);
</script>
<template>
  <div class="sentence-library-page sentence-management sentence-editor-page"><header class="library-heading"><h1>{{ id ? '编辑句子' : '新建句子' }}</h1><RouterLink class="muted-link" to="/sentences/manage">返回题库维护</RouterLink></header><SentenceNav active="MANAGEMENT" />
    <SentenceManagementGate @authorized="reload">
      <p v-if="loading" role="status">正在读取题目…</p><p v-if="error" class="inline-error" role="alert">{{ error }}</p><p v-if="notice" class="sentence-notice" role="status">{{ notice }}</p>
      <section v-if="conflict && submittedDraft" class="sentence-conflict"><h2>未保存的修改</h2><p>下方表单已读取服务端最新版本，请先核对。</p><details><summary>查看本次提交内容</summary><dl class="sentence-draft"><dt>英文</dt><dd>{{ submittedDraft.englishText }}</dd><dt>参考译文</dt><dd>{{ submittedDraft.referenceTranslation }}</dd><dt>解析</dt><dd>{{ submittedDraft.explanation }}</dd><dt>来源</dt><dd>{{ submittedDraft.source }} · {{ submittedDraft.sourceReference || '无补充' }}</dd><dt>难度 / 状态 / 原版本</dt><dd>{{ submittedDraft.difficulty }} / {{ submittedDraft.status }} / {{ submittedDraft.version }}</dd><dt>关联词 ID</dt><dd>{{ submittedDraft.wordIds.join('、') || '无' }}</dd></dl></details><button class="btn btn-secondary" :disabled="busy || !conflictLoaded" @click="conflict = false; error = ''">已核对最新版本，继续编辑</button></section>
      <div v-if="id" class="live-actions"><span class="subtle-copy">读取版本 {{ form.version }}</span><button class="muted-link" :disabled="busy" @click="reload">重新加载题目</button></div>
      <p v-if="uncertain && !id" class="sentence-notice">请先在<RouterLink to="/sentences/manage">题库列表</RouterLink>确认新建结果。</p>
      <form class="sentence-editor" @submit.prevent="save"><fieldset :disabled="locked">
        <label for="sentence-english">英文原文</label><textarea id="sentence-english" v-model="form.englishText" lang="en" required maxlength="2000" rows="3" />
        <label for="sentence-reference">参考译文</label><textarea id="sentence-reference" v-model="form.referenceTranslation" required maxlength="2000" rows="3" />
        <label for="sentence-explanation">解析</label><textarea id="sentence-explanation" v-model="form.explanation" required maxlength="4000" rows="5" />
        <div class="sentence-editor-pair"><AppSelect v-model="form.difficulty" :options="sentenceLevelOptions" label="难度" :disabled="locked" /><AppSelect v-model="form.status" :options="sentenceStatusOptions" label="状态" :disabled="locked" /></div>
        <p class="subtle-copy">停用后保留原练习、作答历史和复习安排。</p>
        <label for="sentence-source">来源说明</label><input id="sentence-source" v-model="form.source" required maxlength="255" />
        <label for="sentence-source-reference">来源补充（可留空）</label><input id="sentence-source-reference" v-model="form.sourceReference" maxlength="512" />
        <div class="sentence-linked-heading"><span>关联词库单词 · {{ linkedWords.length }} / 50</span><button type="button" class="muted-link" :disabled="linkedWords.length >= 50" @click="picker = true">添加单词</button><button v-if="linkedWords.length" type="button" class="muted-link" @click="linkedWords = []">清空关联</button></div>
        <ul class="sentence-word-tags"><li v-for="word in linkedWords" :key="word.wordId"><span lang="en">{{ word.word }}</span><button type="button" :aria-label="`移除关联 ${word.word}`" @click="removeWord(word.wordId)">移除</button></li></ul>
        <button type="submit" class="btn btn-primary">{{ saving ? '保存中…' : '保存题目' }}</button>
      </fieldset><p v-if="validation" class="inline-error" role="alert">{{ validation }}</p></form>
      <SentenceWordPicker v-model="picker" @select="addWord" />
    </SentenceManagementGate>
  </div>
</template>
