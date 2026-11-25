import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialTimer,
  toggleTimer,
  secondsLeft,
  finishTimer,
  selectMode,
  restoreTimer,
} from '../src/timer.ts';
test('deadline accounts for delayed ticks; pause preserves exact remaining seconds', () => {
  const t = initialTimer();
  toggleTimer(t, 1000);
  assert.equal(secondsLeft(t, 62000), 1439);
  toggleTimer(t, 62000);
  assert.equal(t.deadline, null);
  assert.equal(secondsLeft(t, 999999), 1439);
  toggleTimer(t, 1000000);
  assert.equal(t.deadline, 2439000);
});
test('sleep across deadline completes exactly once and waits for user', () => {
  const t = initialTimer();
  toggleTimer(t, 0);
  assert.equal(finishTimer(t, 99999999), true);
  assert.equal(t.completed, 1);
  assert.equal(t.mode, 'short');
  assert.equal(t.deadline, null);
  assert.equal(finishTimer(t, 99999999), false);
});
test('fourth focus earns long break; break returns to focus', () => {
  const t = initialTimer();
  t.completed = 3;
  toggleTimer(t, 0);
  finishTimer(t, 1500000);
  assert.equal(t.mode, 'long');
  toggleTimer(t, 1500000);
  finishTimer(t, 2400000);
  assert.equal(t.mode, 'focus');
  assert.equal(t.completed, 4);
});
test('mode change cancels current running session', () => {
  const t = initialTimer();
  toggleTimer(t, 0);
  selectMode(t, 'short');
  assert.equal(t.remaining, 300);
  assert.equal(t.deadline, null);
});
test('restore preserves a valid active deadline, rejects corrupted input', () => {
  const t = initialTimer();
  toggleTimer(t);
  assert.deepEqual(restoreTimer(JSON.parse(JSON.stringify(t))), t);
  assert.deepEqual(
    restoreTimer({ ...t, durations: { focus: -1 } }),
    initialTimer(),
  );
  assert.deepEqual(restoreTimer({ ...t, deadline: 'bad' }), initialTimer());
  assert.deepEqual(restoreTimer(null), initialTimer());
});
