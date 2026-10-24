<script setup lang="ts">
import { nextTick, onMounted, ref, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useSentenceSession } from '../../composables/useSentenceSession';
import { sentenceAssessments } from '../../types/sentences';
import ReviewHeader from '../../components/learning/ReviewHeader.vue';
import AppButton from '../../components/ui/AppButton.vue';
import StatePanel from '../../components/ui/StatePanel.vue';
import SentenceScheduleDialog from '../../components/learning/SentenceScheduleDialog.vue';
import SentenceNotePanel from '../../components/learning/SentenceNotePanel.vue';
import SentenceCollectDialog from '../../components/learning/SentenceCollectDialog.vue';
import { useStudySurface } from '../../composables/useStudySurface';
const props = defineProps<{ requestedSessionId?: number }>();
const surface = useStudySurface();
const session = useSentenceSession(useAuthStore().user!.id, props.requestedSessionId ?? Number(useRoute().params.sessionId));
const { progress, current, pending, translation, loading, saving, busy, error, notice, lastSchedule, validation, blocked, canSubmit, canReview } = session;
const scheduleId = ref<number | null>(null);
const scheduleOpen = ref(false);
const collectOpen = ref(false);
const collectWord = ref<{ wordId: number; word: string }>();
const textarea = ref<HTMLTextAreaElement>();
const reviewGroup = ref<HTMLElement>();
function submitTranslation(event?: KeyboardEvent) { if (!event?.isComposing) void session.submit('ANSWER'); }
watch([current, busy], async () => { await nextTick(); if (busy.value || pending.value || surface && !surface.active.value) return; if (current.value?.status === 'PENDING') textarea.value?.focus(); else if (current.value?.status === 'AWAITING_REVIEW') reviewGroup.value?.focus(); });
onMounted(session.load);
watchEffect(() => { if (surface) surface.state.source = current.value ? `${current.value.source}${current.value.sourceReference ? ` · ${current.value.sourceReference}` : ''} · 难度 ${current.value.difficulty}` : '句子题库'; });
</script>
<template>
  <div class="review-page learning-page sentence-study"><ReviewHeader :completed="progress?.completedCount || 0" :total="progress?.totalCount || 0" back-to="/sentences/records" label="句子英译中" noun="句" /><div class="learning-main"><StatePanel :loading="loading" /><div v-if="progress?.status === 'COMPLETED' &amp;&amp; !current" class="workspace-start"><h2>本轮已完成</h2><RouterLink :to="`/sentences/sessions/${progress.sessionId}/result`" class="btn btn-secondary">查看结果</RouterLink></div><p v-if="notice" class="live-notice" role="status">{{ notice }}</p><div v-if="error" class="learning-error sentence-session-error" role="alert"><p>{{ error }}</p><button v-if="pending && !blocked" class="violet-link" :disabled="busy" @click="session.retry">重试原请求</button><button v-else-if="!blocked" class="violet-link" :disabled="busy" @click="session.load">重新同步题目</button><RouterLink to="/sentences/records" class="violet-link">返回练习记录</RouterLink></div>
    <div v-if="lastSchedule" class="sentence-last-schedule" role="status"><span v-if="lastSchedule.value">上次自评句子的当前安排：{{ lastSchedule.value.nextReviewDate }} · 档位 {{ lastSchedule.value.reviewLevel }}</span><span v-else>{{ lastSchedule.value === null ? '上次自评句子暂无复习安排' : '服务端尚未返回复习安排' }}</span><button class="violet-link" @click="scheduleId = lastSchedule.sentenceId; scheduleOpen = true">查询当前安排</button></div><section v-if="current" class="learning-card sentence-study-card" :aria-busy="busy" :data-item-id="current.itemId" :data-status="current.status"><h1 class="sentence-english" lang="en">{{ current.englishText }}</h1><p v-if="!surface" class="sentence-source subtle-copy">难度 {{ current.difficulty }} · {{ current.source }}<span v-if="current.sourceReference"> · {{ current.sourceReference }}</span></p><p v-else class="sentence-source subtle-copy">英译中 · 难度 {{ current.difficulty }}</p>
      <form v-if="current.status === 'PENDING'" class="sentence-translation-form" @submit.prevent="session.submit('ANSWER')" @keydown.ctrl.enter.prevent="submitTranslation($event)" @keydown.meta.enter.prevent="submitTranslation($event)"><label for="sentence-translation">你的中文译文</label><textarea id="sentence-translation" ref="textarea" v-model="translation" rows="5" maxlength="2000" :disabled="!canSubmit" :aria-invalid="!!validation" aria-describedby="sentence-validation" placeholder="先写下你对句子意思的理解" /><p v-if="validation" id="sentence-validation" class="inline-error" role="alert">{{ validation }}</p><div class="live-actions"><AppButton type="submit" :busy="saving" :disabled="!canSubmit">提交译文</AppButton><AppButton variant="secondary" :disabled="!canSubmit" @click="session.submit('REVEAL')">不会，查看解析</AppButton></div></form>
      <div v-else-if="current.status === 'AWAITING_REVIEW'" class="sentence-feedback"><dl class="sentence-comparison"><div><dt>{{ current.action === 'REVEAL' ? '本次操作' : '你的译文（已提交）' }}</dt><dd class="sentence-original">{{ current.action === 'REVEAL' ? '不会，查看解析' : current.translation }}</dd></div><div><dt>参考译文</dt><dd class="sentence-reference">{{ current.referenceTranslation }}</dd></div><div><dt>参考解析</dt><dd class="sentence-explanation">{{ current.explanation }}</dd></div></dl><p class="sentence-reference-note">参考译文不是唯一答案，请对照核心含义自评。</p><div ref="reviewGroup" class="sentence-self-review" role="group" aria-label="理解程度自评" tabindex="-1"><button v-for="entry in sentenceAssessments" :key="entry.value" type="button" :disabled="!canReview" :aria-pressed="pending?.kind === 'self-review' && pending.body.assessment === entry.value" @click="session.review(entry.value)">{{ entry.label }}</button></div><p class="subtle-copy">保存自评后进入下一题；已提交的译文不能修改。</p></div>
      <component :is="surface ? 'details' : 'div'" class="workspace-notes"><summary v-if="surface">个人笔记</summary><SentenceNotePanel :key="current.itemId" :sentence-id="current.sentenceId" :personal-note="current.personalNote" :attempt-id="current.attemptId" @saved="current.personalNote = $event" /></component>
      <nav v-if="current.linkedWords.length" class="sentence-linked-words" aria-label="关联单词"><span class="subtle-copy">关联单词</span><div v-for="word in current.linkedWords" :key="word.wordId" class="sentence-linked-word"><RouterLink :to="`/words/${word.wordId}`" lang="en">{{ word.word }}</RouterLink><button type="button" class="muted-link" :disabled="busy" :aria-label="`收录关联单词 ${word.word}`" @click="collectWord = word; collectOpen = true">收词</button></div></nav>
      <SentenceCollectDialog v-if="collectWord && collectOpen" :key="current.itemId" v-model="collectOpen" :session-id="progress!.sessionId" :item-id="current.itemId" :word-id="collectWord.wordId" :word="collectWord.word" />
    </section><SentenceScheduleDialog v-model="scheduleOpen" :sentence-id="scheduleId" /><p class="sentence-scope-note subtle-copy">句子自评不影响单词计划、每日目标或默写统计。</p></div></div>
</template>
