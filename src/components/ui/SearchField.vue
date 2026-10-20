<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
defineProps<{ modelValue: string; label: string; placeholder?: string }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <div class="search-field">
    <Search :size="18" aria-hidden="true" /><input
      type="search"
      :aria-label="label"
      :placeholder="placeholder || label"
      :value="modelValue"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    /><button
      v-if="modelValue"
      type="button"
      :aria-label="`清空${label}`"
      @click="$emit('update:modelValue', '')"
    >
      <X :size="15" />
    </button>
  </div>
</template>
