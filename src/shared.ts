import type { TimerState, Mode } from './timer';
export type Side = 'left' | 'right';
export type Snapshot = TimerState & {
  seconds: number;
  expanded: boolean;
  side: Side;
  pinned: boolean;
};
export type Command =
  | {
      type:
        | 'toggle'
        | 'reset'
        | 'pin'
        | 'side'
        | 'quit'
        | 'drag-start'
        | 'drag-end';
    }
  | { type: 'mode'; mode: Mode }
  | { type: 'durations'; durations: Record<Mode, number> };
export interface TimerAPI {
  command: (command: Command) => void;
  snapshot: () => Promise<Snapshot>;
  subscribe: (callback: (snapshot: Snapshot) => void) => () => void;
}
