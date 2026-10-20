import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { uiPreview } from "../config";
import { useAuthStore } from "../stores/auth";
import AppLayout from "../layouts/AppLayout.vue";
import PreviewLayout from "../layouts/PreviewLayout.vue";
import FocusLayout from "../layouts/FocusLayout.vue";
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
      { path: "learn", component: () => import("../views/live/DailyView.vue") },
      { path: "learn/:batchId(\\d+)", component: () => import("../views/live/DailyView.vue") },
      { path: "plan", component: () => import("../views/live/PlanView.vue") },
      { path: "settings", component: () => import("../views/live/SettingsView.vue") },
      { path: "statistics", component: () => import("../views/live/StatisticsView.vue") },
      { path: "records", component: () => import("../views/live/RecordsView.vue") },
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
  {
    path: "/study",
    component: FocusLayout,
    children: [
      {
        path: ":batchId(\\d+)",
        component: () => import("../views/learning/StudyView.vue"),
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
