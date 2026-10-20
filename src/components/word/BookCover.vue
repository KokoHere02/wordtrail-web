<script setup lang="ts">
defineProps<{ label: string; empty?: boolean; small?: boolean }>();
</script>
<template>
  <span
    :class="[
      'book-cover',
      { 'book-cover-empty': empty, 'book-cover-small': small },
    ]"
    aria-hidden="true"
    ><span class="book-spine" /><span v-if="empty" class="cover-plus">+</span
    ><template v-else
      ><span
        :class="['cover-label', { 'cover-label-long': label.length > 7 }]"
        >{{ label }}</span
      ><span class="cover-line" /><span
        class="cover-line cover-line-short" /></template
  ></span>
</template>
