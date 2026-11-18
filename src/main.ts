import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import { router } from "./router";
import { setExpiredHandler } from "./api/http";
import { useAuthStore } from "./stores/auth";
import { initializeTheme } from './composables/useTheme';
import { registerFounderFonts } from './assets/fonts/founder/register';

initializeTheme();
registerFounderFonts();
export const app = createApp(App);
app.use(createPinia());
setExpiredHandler(() => {
  useAuthStore().clear();
  const target = router.currentRoute.value;
  if (!target.meta.public)
    void router.replace({
      path: "/login",
      query: { redirect: target.fullPath },
    });
});
app.use(router);
app.mount("#app");
