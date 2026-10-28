// Explicit archived data fixture. Never creates or resumes practice through a retired API.
export function seedHistoricalPractice(storage, account, words, result = 2) {
  const timestamp = '2025-01-02T09:10:00';
  const items = words.map((word, index) => ({ itemId: 900001 + index, wordId: word.id, word: word.word, phonetic: word.phonetic, meaning: word.translation, translationGroups: word.translationGroups, sortOrder: index + 1, result, answered: true, answeredAt: timestamp, nextItemId: null }));
  const batch = { id: 900, bookId: null, selectionType: 'MANUAL', status: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, items };
  const events = items.map((item, index) => ({ logId: 500000 + index, batchId: batch.id, itemId: item.itemId, wordId: item.wordId, learningDate: timestamp.slice(0, 10), answeredAt: timestamp, result, taskType: 'PRACTICE', eventType: 'ANSWER', correctsLogId: null, attemptNo: 1, affectsSchedule: false, scheduleBefore: null, scheduleAfter: null, scheduleAvailable: false }));
  const state = { batches: [batch], events, nextId: 901 };
  storage.setItem(`wordtrail.mock.${account}`, JSON.stringify(state));
  return state;
}
