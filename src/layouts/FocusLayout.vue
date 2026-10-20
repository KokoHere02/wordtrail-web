<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>
<template>
  <div class="focus-layout"><RouterView :key="route.path" /></div>
</template>
