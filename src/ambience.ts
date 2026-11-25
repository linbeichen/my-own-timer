import rain from './audio/rain.wav?url';
import surf from './audio/surf.wav?url';
import brown from './audio/brown.wav?url';

const tracks = { rain, surf, brown };
type Track = keyof typeof tracks | 'off';
const storageKey = 'focus-ambience-v1';
const audio = new Audio();
audio.loop = true;
let track: Track = 'off';
let volume = 35;
let focusing = false;
let preview = false;
let active: Track = 'off';
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (Object.hasOwn(tracks, stored.track)) track = stored.track;
  if (Number.isInteger(stored.volume))
    volume = Math.max(0, Math.min(100, stored.volume));
} catch {
  /* Start with quiet defaults if preferences are unavailable. */
}
audio.volume = volume / 100;

export function setupAmbience(panel: HTMLElement) {
  const list = panel.querySelector<HTMLSelectElement>('select')!;
  const slider = panel.querySelector<HTMLInputElement>('input')!;
  const output = panel.querySelector('output')!;
  const listen = panel.querySelector<HTMLButtonElement>('#listen')!;
  const message = panel.querySelector<HTMLElement>('[role="status"]')!;
  function reflect() {
    list.value = track;
    slider.value = String(volume);
    output.value = volume + '%';
    listen.disabled = track === 'off' || focusing;
    listen.textContent =
      focusing && track !== 'off'
        ? '专注时播放'
        : preview
          ? '停止试听'
          : '试听';
  }
  function sync() {
    const desired = focusing || preview ? track : 'off';
    if (active === desired) return;
    active = desired;
    audio.pause();
    message.textContent = '';
    if (desired === 'off') return;
    audio.src = tracks[desired];
    void audio.play().catch((error: Error) => {
      if (active !== desired || error.name === 'AbortError') return;
      preview = false;
      message.textContent = '播放失败，请重新选择声音。';
      reflect();
    });
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ track, volume }));
    } catch {
      /* Session preferences still apply. */
    }
  }
  list.onchange = () => {
    track = list.value as Track;
    if (track === 'off') preview = false;
    persist();
    reflect();
    sync();
  };
  slider.oninput = () => {
    volume = Number(slider.value);
    audio.volume = volume / 100;
    persist();
    reflect();
  };
  listen.onclick = () => {
    preview = !preview;
    reflect();
    sync();
  };
  reflect();
  return {
    focus(value: boolean) {
      if (focusing === value) return;
      focusing = value;
      preview = false;
      reflect();
      sync();
    },
    close() {
      preview = false;
      reflect();
      sync();
    },
  };
}
