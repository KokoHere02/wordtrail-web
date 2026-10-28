import assert from 'node:assert/strict';

export async function chooseSelect(root, label, option) {
  const { nextTick } = await import('vue');
  const field = [...root.querySelectorAll('.app-select')].find(node => node.querySelector('label')?.textContent.trim() === label);
  assert.ok(field, `select ${label}`);
  const trigger = field.querySelector('[role="combobox"]');
  assert.equal(trigger.disabled || trigger.matches(':disabled'), false, `${label} enabled`);
  trigger.click();
  await nextTick();
  const choice = [...field.querySelectorAll('[role="option"]')].find(node => node.textContent.trim() === option);
  assert.ok(choice, `option ${option}`);
  choice.click();
  await nextTick();
}
