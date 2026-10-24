<script setup lang="ts">
// Matches the existing example/exampleZh display model; API learning DTOs have no examples yet.
defineProps<{ example?: string | null; exampleZh?: string | null }>();
</script>
<template>
  <div v-if="example?.trim()" class="review-example-space has-example">
    <blockquote v-if="example?.trim()" class="review-example"><p lang="en">{{ example }}</p><p v-if="exampleZh?.trim()" class="review-example-translation">{{ exampleZh }}</p></blockquote>
  </div>
</template>
