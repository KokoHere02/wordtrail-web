// Scripted Section 20 service fixture. Never imported by application code.
export function createDictationExamFixture() {
  const copy = value => structuredClone(value);
  const groups = meaning => [{ partOfSpeech: 'n.', meaning }];
  const vocabulary = ['apple', 'absorb', 'abstract', 'abundant', 'academic', 'accelerate', 'accept', 'access', 'accommodate', 'accomplish', 'abandon', 'adapt', 'adjust'];
  const plan = vocabulary.map((word, i) => ({ wordId: 1001 + i, word, phonetic: null, translation: `释义 ${i}`, translationGroups: groups(`释义 ${i}`), planStatus: 'ACTIVE', joinedAt: '2026-01-01T00:00:00', firstLearnedAt: '2026-01-02T00:00:00', lastLearnedAt: '2026-10-27T00:00:00', lastResult: 1, nextReviewAt: null, reviewLevel: 1 }));
  const control = { tasks: new Map(), calls: [], events: [], nextId: 901, decisions: ['INCORRECT', 'REVEALED', 'CORRECT', 'CORRECT'], day: '2026-10-28', loseAction: undefined, createMode: 'normal', staleOnce: false, alreadyOnce: false, legacyOnce: false, failNext: false, failNextAfterAnswer: false, reuseOnce: false, emptyPlan: false, failMistakes: false, answerGate: undefined };
  const ok = data => ({ status: 200, data: copy(data) });
  const reject = (code, message = code, status = 409) => ({ status, error: { code, message } });
  const paginate = (records, params = {}) => { const page = Number(params.page || 1), size = Number(params.size || 10); return { page, size, total: records.length, records: records.slice((page - 1) * size, page * size) }; };
  function addTask(ids = [1001, 1011, 1012, 1013], changes = {}) {
    const id = control.nextId++;
    const entries = ids.map((wordId, index) => { const word = plan.find(row => row.wordId === wordId) || { wordId, word: `snapshot-${wordId}`, translation: '旧版释义' }; return { ...word, itemId: id * 100 + index + 1, answered: false, version: 0 }; });
    const task = { batchId: id, bookId: null, taskType: 'PRACTICE', practiceMode: 'DICTATION', status: 'IN_PROGRESS', singleAttempt: true, canContinue: true, totalCount: entries.length, completedCount: 0, passedCount: null, needsPracticeCount: null, accuracy: null, attemptCount: 0, nextItemId: entries[0]?.itemId ?? null, attemptLimit: 1, createdAt: `${control.day}T09:00:00`, completedAt: null, ...changes };
    const state = { task, entries, index: 0, words: [], receipts: new Map(), decisions: [...control.decisions] };
    control.tasks.set(id, state); return state;
  }
  const published = () => control.events.filter(event => { const task = control.tasks.get(event.batchId)?.task; return task?.singleAttempt === false || task?.status === 'COMPLETED'; });
  const mistakes = () => { const latest = new Map(); for (const event of published()) latest.set(event.wordId, event); return [...latest.values()].filter(event => event.verdict !== 'CORRECT').map(event => event.wordSnapshot); };
  function commit(state, body, requestId) {
    const word = state.entries[state.index], verdict = body.action === 'REVEAL' ? 'REVEALED' : state.decisions[state.index] || 'CORRECT';
    const submittedAnswer = body.action === 'REVEAL' ? null : body.input;
    const value = { logId: control.events.length + 1, itemId: word.itemId, action: body.action, submittedAnswer, expectedWord: word.word, translation: word.translation, translationGroups: word.translationGroups, verdict, attemptNo: 1, correctStreak: verdict === 'CORRECT' ? 1 : 0, itemStatus: 'DONE', completionReason: verdict === 'CORRECT' ? 'RECALLED' : 'LIMIT_REACHED', answeredAt: `${control.day}T10:00:00`, affectsSchedule: false };
    const row = { itemId: word.itemId, wordId: word.wordId, word: word.word, translation: word.translation, translationGroups: word.translationGroups, lastVerdict: verdict, lastInput: submittedAnswer, attemptCount: 1, correctStreak: value.correctStreak, learningStatus: 'DONE', completionReason: value.completionReason, learningDate: control.day, answeredAt: value.answeredAt };
    control.events.push({ logId: value.logId, batchId: state.task.batchId, itemId: word.itemId, wordId: word.wordId, learningDate: control.day, answeredAt: value.answeredAt, taskType: 'PRACTICE', practiceMode: 'DICTATION', action: body.action, input: submittedAnswer, expectedWord: word.word, verdict, attemptNo: 1, correctStreakBefore: 0, correctStreakAfter: value.correctStreak, itemStatusAfter: 'DONE', completionReason: value.completionReason, affectsSchedule: false, wordSnapshot: row });
    word.answered = true; state.words.push(row); state.index++;
    Object.assign(state.task, { completedCount: state.index, attemptCount: state.index, nextItemId: state.entries[state.index]?.itemId ?? null });
    if (state.index === state.entries.length) Object.assign(state.task, { status: 'COMPLETED', canContinue: false, passedCount: state.words.filter(row => row.lastVerdict === 'CORRECT').length, needsPracticeCount: state.words.filter(row => row.lastVerdict !== 'CORRECT').length, accuracy: state.words.filter(row => row.lastVerdict === 'CORRECT').length / state.task.totalCount, completedAt: `${control.day}T10:00:00` });
    state.receipts.set(requestId, { body: copy(body), value }); return value;
  }
  function receipt(state, value) {
    if (value.action === 'ANSWER' && state.task.status !== 'COMPLETED') { const { expectedWord, translation, verdict, correctStreak, completionReason, ...hidden } = value; return { ...hidden, translationGroups: [], progress: state.task }; }
    return { ...value, progress: state.task };
  }
  async function handle(url, method, body, params = {}) {
    control.calls.push({ url, method, body: copy(body ?? null), params: copy(params) });
    if (url === '/learning-plan/words' && method === 'get') return ok(paginate(control.emptyPlan ? [] : plan.filter(row => !params.keyword || row.word.startsWith(params.keyword)), params));
    if (!url.startsWith('/dictation/')) return;
    if (url === '/dictation/batches' && method === 'post') {
      if (control.createMode === 'empty') return reject('NO_DICTATION_WORDS', '没有可选默写题');
      if (control.createMode === 'reject') return reject('INVALID_DICTATION_SELECTION', '选词已变化，请重新选择');
      const candidates = body.source === 'MISTAKES' ? mistakes().map(row => row.wordId) : plan.map(row => row.wordId);
      const state = addTask(body.wordIds || candidates.slice(0, Math.min(body.count || 20, 4)));
      if (body.source === 'MISTAKES') state.decisions = state.entries.map(() => 'CORRECT');
      if (control.createMode === 'lost') return { networkError: true };
      return { ...ok(state.task), status: 201 };
    }
    if (url === '/dictation/batches') return ok(paginate([...control.tasks.values()].map(state => state.task).filter(task => task.status === (params.status || 'IN_PROGRESS')).reverse(), params));
    if (url === '/dictation/mistakes') { if (control.failMistakes) { control.failMistakes = false; return reject('TEMPORARY', '错词列表暂不可用', 503); } return ok(paginate(mistakes(), params)); }
    const history = url.match(/^\/dictation\/words\/(\d+)\/history$/);
    if (history) return ok(paginate(published().filter(row => row.wordId === Number(history[1])).reverse().map(({ wordSnapshot, ...event }) => event), params));
    const match = url.match(/^\/dictation\/batches\/(\d+)(?:\/(next|result\/words|items\/(\d+)\/answer))?$/);
    const state = match && control.tasks.get(Number(match[1]));
    if (!state) return reject('BATCH_NOT_FOUND', '测验不存在', 404);
    if (!match[2]) return ok(state.task);
    if (match[2] === 'result/words') return state.task.singleAttempt && state.task.status !== 'COMPLETED' ? reject('DICTATION_NOT_COMPLETED') : ok(paginate(state.words, params));
    if (!state.task.singleAttempt || control.legacyOnce) { control.legacyOnce = false; return reject('DICTATION_LEGACY_READ_ONLY'); }
    if (match[2] === 'next') {
      if (control.failNext) { control.failNext = false; return reject('TEMPORARY', '题目暂不可用', 503); }
      if (!state.task.canContinue) return reject('DICTATION_NOT_IN_PROGRESS');
      const word = state.entries[state.index];
      return ok({ itemId: word.itemId, prompt: '释义 [目标词]', promptGroups: groups('提示释义 [目标词]；' + '较长释义。'.repeat(10)), presentationId: `exam-${word.itemId}-${word.version}`, audioUrl: `/api/dictation/batches/${state.task.batchId}/items/${word.itemId}/audio?presentationId=exam-${word.itemId}-${word.version}`, nextAttemptNo: 1, correctStreak: 0, requiredCorrectStreak: 1, attemptLimit: 1 });
    }
    if (control.answerGate) await control.answerGate;
    const cached = state.receipts.get(body.requestId);
    if (cached) return JSON.stringify(cached.body) === JSON.stringify(body) ? ok(receipt(state, cached.value)) : reject('REQUEST_ID_REUSED');
    if (control.reuseOnce) { control.reuseOnce = false; return reject('REQUEST_ID_REUSED'); }
    const word = state.entries[state.index];
    if (control.alreadyOnce) { control.alreadyOnce = false; commit(state, { action: 'ANSWER', input: 'external answer', attemptNo: 1, presentationId: body.presentationId, requestId: 'external-request' }, 'external-request'); return reject('DICTATION_ALREADY_ANSWERED'); }
    if (!word || word.itemId !== Number(match[3])) return reject('DICTATION_ALREADY_ANSWERED');
    if (control.staleOnce) { control.staleOnce = false; word.version++; return reject('STALE_DICTATION_ANSWER'); }
    if (body.attemptNo !== 1 || body.presentationId !== `exam-${word.itemId}-${word.version}`) return reject('INVALID_DICTATION_ANSWER');
    const value = commit(state, body, body.requestId);
    if (control.failNextAfterAnswer) { control.failNextAfterAnswer = false; control.failNext = true; }
    if (control.loseAction === body.action) { control.loseAction = undefined; return { networkError: true }; }
    return ok(receipt(state, value));
  }
  return Object.assign(control, { handle, addTask, mistakes });
}
