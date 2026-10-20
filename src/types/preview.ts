export type BookCategory = "考试英语" | "日常英语" | "程序员" | "我的词单";
export interface PreviewBook {
  id: number;
  name: string;
  label: string;
  description: string;
  count: number;
  category: BookCategory;
  custom?: boolean;
  words?: string[];
}
export interface PreviewWord {
  id: number;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleZh: string;
}
export type Recall = "forgot" | "uncertain" | "known";
export interface PreviewRecord {
  id: number;
  bookName: string;
  mode: "记忆复习" | "单词默写";
  total: number;
  known: number;
  uncertain: number;
  forgot: number;
  seconds: number;
  createdAt: string;
}
