<script setup lang="ts">
import { computed, provide, ref, onActivated, onDeactivated } from 'vue';
import { studySurfaceKey, type StudySurfaceState } from '../../composables/useStudySurface';
const props = defineProps<{ active: boolean; state: StudySurfaceState }>();
const visible = ref(true);
onActivated(() => { visible.value = true; });
onDeactivated(() => { visible.value = false; });
provide(studySurfaceKey, { active: computed(() => props.active && visible.value), state: props.state });
</script>
<template><div class="study-mode-host"><slot /></div></template>
