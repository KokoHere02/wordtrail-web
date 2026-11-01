<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { request, errorMessage } from '../../api/http';
const props = defineProps<{ wordId: number }>();
type Sentence = {id:number;englishText:string;referenceTranslation:string;learning:boolean};
const rows=ref<Sentence[]>([]), error=ref(''), loading=ref(false);
async function load(){loading.value=true;try{rows.value=await request<Sentence[]>('GET','/sentence-practice/sentences',undefined,{wordId:props.wordId,limit:5});error.value='';}catch(e){error.value=errorMessage(e);}finally{loading.value=false;}}
async function toggle(row:Sentence){try{await request(row.learning?'DELETE':'PUT',`/sentence-practice/learning/${row.id}`);row.learning=!row.learning;}catch(e){error.value=errorMessage(e);}}
onMounted(load);watch(()=>props.wordId,load);
</script>
<template><section class="word-detail-panel"><h2>关联句子</h2><p v-if="loading">加载中…</p><p v-if="error" role="alert">{{ error }}</p><p v-if="!loading && !error && !rows.length">这个单词暂无关联句子。</p><article v-for="row in rows" :key="row.id" class="word-sentence-row"><p lang="en">{{ row.englishText }}</p><p>{{ row.referenceTranslation }}</p><button class="btn btn-secondary" @click="toggle(row)">{{ row.learning ? '移出学习列表' : '加入学习列表' }}</button></article><RouterLink :to="{path:'/sentences',query:{wordId}}">查看全部关联句子</RouterLink></section></template>
