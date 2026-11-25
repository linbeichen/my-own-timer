export type Mode = 'focus' | 'short' | 'long';
export type TimerState = {
  mode: Mode;
  durations: Record<Mode, number>;
  remaining: number;
  deadline: number | null;
  completed: number;
};
export const initialTimer = (): TimerState => ({
  mode: 'focus',
  durations: { focus: 25, short: 5, long: 15 },
  remaining: 25 * 60,
  deadline: null,
  completed: 0,
});
export function secondsLeft(timer: TimerState, now = Date.now()): number {
  return timer.deadline === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
export function toggleTimer(timer: TimerState, now = Date.now()): void {
  if (timer.deadline !== null) {
    timer.remaining = secondsLeft(timer, now);
    timer.deadline = null;
  } else {
    timer.deadline = now + timer.remaining * 1000;
  }
}
export function selectMode(timer: TimerState, mode: Mode): void {
  timer.mode = mode;
  timer.deadline = null;
  timer.remaining = timer.durations[mode] * 60;
}
// A completed stage prepares the next one, but does not start it unattended.
export function finishTimer(timer: TimerState, now = Date.now()): boolean {
  if (timer.deadline === null || secondsLeft(timer, now) > 0) return false;
  const wasFocus = timer.mode === 'focus';
  if (wasFocus) timer.completed++;
  selectMode(
    timer,
    wasFocus ? (timer.completed % 4 === 0 ? 'long' : 'short') : 'focus',
  );
  return true;
}
export function restoreTimer(value: unknown): TimerState {
  const fallback = initialTimer();
  if (!value || typeof value !== 'object') return fallback;
  const t = value as TimerState;
  if (!['focus', 'short', 'long'].includes(t.mode) || !t.durations)
    return fallback;
  if (
    !['focus', 'short', 'long'].every(
      (k) =>
        Number.isInteger(t.durations[k as Mode]) &&
        t.durations[k as Mode] >= 1 &&
        t.durations[k as Mode] <= 180,
    )
  )
    return fallback;
  if (
    !Number.isFinite(t.remaining) ||
    t.remaining < 0 ||
    t.remaining > 10800 ||
    !Number.isInteger(t.completed) ||
    t.completed < 0
  )
    return fallback;
  if (
    t.deadline !== null &&
    (!Number.isFinite(t.deadline) || t.deadline > Date.now() + 10800000)
  )
    return fallback;
  return {
    mode: t.mode,
    durations: { ...t.durations },
    remaining: t.remaining,
    deadline: t.deadline,
    completed: t.completed,
  };
}
