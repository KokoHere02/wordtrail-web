<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost";
    busy?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "primary", type: "button" },
);
</script>
<template>
  <button
    :type="type"
    :class="['btn', `btn-${variant}`]"
    :disabled="disabled || busy"
    :aria-busy="busy"
  >
    <span v-if="busy" class="spinner" aria-hidden="true" /><slot />
  </button>
</template>
