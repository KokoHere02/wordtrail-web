import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { uiPreview } from "../config";
import { useAuthStore } from "../stores/auth";
import AppLayout from "../layouts/AppLayout.vue";
import PreviewLayout from "../layouts/PreviewLayout.vue";

const visualRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    component: PreviewLayout,
    children: [
      { path: "", redirect: "/today" },
      {
        path: "today",
        component: () => import("../views/preview/TodayView.vue"),
      },
      {
        path: "learn",
        component: () => import("../views/preview/MemoryView.vue"),
      },
      {
        path: "dictation",
        component: () => import("../views/preview/DictationView.vue"),
      },
      {
        path: "books",
        component: () => import("../views/preview/LibraryView.vue"),
      },
      {
        path: "books/:bookId(\\d+)",
        component: () => import("../views/preview/WordListView.vue"),
      },
      {
        path: "records",
        component: () => import("../views/preview/RecordsView.vue"),
      },
      {
        path: "records/:recordId(\\d+)",
        component: () => import("../views/preview/PreviewResultView.vue"),
      },
      { path: "learning", redirect: "/records" },
      { path: "study/:batchId(\\d+)", redirect: "/learn" },
      { path: "login", redirect: "/today" },
      { path: "register", redirect: "/today" },
    ],
  },
];
const apiRoutes: RouteRecordRaw[] = [
  {
    path: "/login",
    component: () => import("../views/auth/AuthView.vue"),
    meta: { public: true },
  },
  {
    path: "/register",
    component: () => import("../views/auth/AuthView.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    component: AppLayout,
    children: [
      { path: "", redirect: "/today" },
      { path: "today", component: () => import("../views/live/TodayView.vue") },
      { path: "learn", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "learn/:batchId(\\d+)", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "study/:batchId(\\d+)", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "plan", component: () => import("../views/live/PlanView.vue") },
      { path: "dictation", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "dictation/mistakes", component: () => import("../views/dictation/DictationMistakesView.vue") },
      { path: "dictation/:batchId(\\d+)", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "dictation/:batchId(\\d+)/result", component: () => import("../views/dictation/DictationResultView.vue") },
      { path: "sentences", component: () => import("../views/sentences/SentenceCatalogView.vue") },
      { path: "sentences/favorites", component: () => import("../views/sentences/SentenceCatalogView.vue") },
      { path: "sentences/review", component: () => import("../views/sentences/SentenceCatalogView.vue") },
      { path: "sentences/due", component: () => import("../views/sentences/SentenceCatalogView.vue") },
      { path: "sentences/statistics", component: () => import("../views/sentences/SentenceStatisticsView.vue") },
      { path: "sentences/notes", component: () => import("../views/sentences/SentenceNotesView.vue") },
      { path: "sentences/manage", component: () => import("../views/sentences/SentenceManagementView.vue") },
      { path: "sentences/manage/new", component: () => import("../views/sentences/SentenceEditorView.vue") },
      { path: "sentences/manage/import", component: () => import("../views/sentences/SentenceCsvImportView.vue") },
      { path: "sentences/manage/:sentenceId(\\d+)/edit", component: () => import("../views/sentences/SentenceEditorView.vue") },
      { path: "sentences/records", component: () => import("../views/sentences/SentenceRecordsView.vue") },
      { path: "sentences/sessions/:sessionId(\\d+)", component: () => import("../views/learning/StudyWorkspaceView.vue"), meta: { workspace: true } },
      { path: "sentences/sessions/:sessionId(\\d+)/result", component: () => import("../views/sentences/SentenceResultView.vue") },
      { path: "words/:wordId(\\d+)", component: () => import("../views/live/WordDetailView.vue") },
      { path: "weak-words", component: () => import("../views/live/WeakWordsView.vue") },
      { path: "settings", component: () => import("../views/live/SettingsView.vue") },
      { path: "settings/security", component: () => import("../views/auth/AccountSecurityView.vue") },
      { path: "statistics", component: () => import("../views/live/StatisticsView.vue") },
      { path: "records", component: () => import("../views/live/RecordsView.vue") },
      { path: "records/dictation", component: () => import("../views/dictation/DictationRecordsView.vue") },
      { path: "records/:batchId(\\d+)", component: () => import("../views/live/DailyResultView.vue") },
      {
        path: "books",
        component: () => import("../views/live/LibraryView.vue"),
        meta: { title: "词书" },
      },
      {
        path: "books/:bookId(\\d+)",
        component: () => import("../views/live/WordListView.vue"),
        meta: { title: "词书" },
      },
      {
        path: "learning",
        component: () => import("../views/learning/LearningView.vue"),
        meta: { title: "我的学习" },
      },
      {
        path: "learning/:batchId(\\d+)/result",
        component: () => import("../views/learning/ResultView.vue"),
        meta: { title: "我的学习" },
      },
    ],
  },
];
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...(uiPreview ? visualRoutes : apiRoutes),
    {
      path: "/:pathMatch(.*)*",
      component: () => import("../views/NotFoundView.vue"),
      meta: { public: true },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
router.beforeEach(async (to) => {
  if (uiPreview) return;
  const auth = useAuthStore();
  await auth.restore();
  if (!to.meta.public && !auth.user)
    return { path: "/login", query: { redirect: to.fullPath } };
  if ((to.path === "/login" || to.path === "/register") && auth.user)
    return "/today";
});
