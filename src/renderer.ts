import './index.css';
import { setupAmbience } from './ambience';
import type { TimerAPI, Snapshot } from './shared';
import type { Mode } from './timer';
declare global {
  interface Window {
    timer: TimerAPI;
  }
}
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
<section class="notch" aria-label="番茄钟">
  <div class="pill"><span class="pill-dot"></span><span id="pill-time">25</span><span class="pill-label">MIN</span><div class="pill-track"><i></i></div></div>
  <div class="card">
    <header><span class="brand"><i></i> MY OWN TIME</span><button class="icon sound-open" id="sound" title="环境音" aria-label="环境音">♫</button><button class="icon" id="pin" title="保持展开" aria-label="保持展开">◇</button></header>
    <div class="tabs" role="group" aria-label="计时模式"><button data-mode="focus">专注</button><button data-mode="short">短休息</button><button data-mode="long">长休息</button></div>
    <div class="clock"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="track" cx="80" cy="80" r="72"/><circle class="progress" cx="80" cy="80" r="72"/></svg><div class="clock-content"><span id="phase">留一点时间，给当下</span><strong id="time">25:00</strong><span id="status">准备好就开始</span></div></div>
    <div class="actions"><button id="reset" class="secondary" aria-label="重置当前阶段" title="重置">↺</button><button id="toggle" class="primary">开始专注 <span>▶</span></button><button id="settings" class="secondary" aria-label="计时设置" title="设置">⚙</button></div>
    <footer><span id="sessions">已完成 0 次专注</span><button id="drag" title="拖动调整高度，也可按住 Option 拖动卡片" aria-label="拖动调整位置">⠿</button><button id="side" title="切换左右停靠">靠左 ←</button></footer>
  </div>
  <form class="settings" hidden><div class="settings-head"><h2>自己的节奏</h2><button type="button" id="close-settings" aria-label="关闭设置">×</button></div><p>设置每一段时间的长度</p><label>专注 <span><input name="focus" type="number" min="1" max="180" required /> 分钟</span></label><label>短休息 <span><input name="short" type="number" min="1" max="180" required /> 分钟</span></label><label>长休息 <span><input name="long" type="number" min="1" max="180" required /> 分钟</span></label><p class="hint">每完成 4 次专注，安排一次长休息。<br>保存会重置当前阶段；下一阶段需手动开始。</p><button class="primary" type="submit">保存设置</button></form>
  <section class="settings sound-panel" hidden aria-label="环境音"><div class="settings-head"><h2>环境音</h2><button type="button" id="close-sound" aria-label="关闭环境音面板">×</button></div><p>开始专注时播放，暂停或休息时停止。</p><label>声音<select><option value="off">关闭</option><option value="rain">窗边细雨</option><option value="surf">海岸潮声</option><option value="brown">柔和棕噪声</option></select></label><label for="volume">音量 <output for="volume"></output></label><input id="volume" type="range" min="0" max="100" step="1"/><button id="listen" class="primary" type="button">试听</button><p role="status"></p></section>
</section>`;
const el = <T extends HTMLElement = HTMLElement>(selector: string) =>
  root.querySelector<T>(selector)!;
const soundPanel = el('.sound-panel');
const ambience = setupAmbience(soundPanel);
let state: Snapshot;
let settingsOpen = false;
let restorePin = false;
function render(s: Snapshot) {
  state = s;
  ambience.focus(s.mode === 'focus' && s.deadline !== null);
  const time = `${String(Math.floor(s.seconds / 60)).padStart(2, '0')}:${String(s.seconds % 60).padStart(2, '0')}`;
  root.dataset.side = s.side;
  root.dataset.mode = s.mode;
  root.classList.toggle('expanded', s.expanded);
  root.classList.toggle('running', s.deadline !== null);
  el('#time').textContent = time;
  el('#pill-time').textContent = String(Math.ceil(s.seconds / 60)).padStart(
    2,
    '0',
  );
  el('.pill').title = time;
  el('#status').textContent =
    s.deadline !== null
      ? '正在进行 · 专注当下'
      : s.seconds < s.durations[s.mode] * 60
        ? '已暂停 · 随时继续'
        : '准备好就开始';
  el('#phase').textContent =
    s.mode === 'focus' ? '留一点时间，给当下' : '放松一下，让思绪呼吸';
  el('#toggle').textContent =
    s.deadline !== null
      ? '暂停  Ⅱ'
      : s.seconds < s.durations[s.mode] * 60
        ? '继续  ▶'
        : s.mode === 'focus'
          ? '开始专注  ▶'
          : '开始休息  ▶';
  el('#sessions').textContent = `已完成 ${s.completed} 次专注`;
  el('#side').textContent = s.side === 'right' ? '靠左 ←' : '靠右 →';
  el('#pin').textContent = s.pinned ? '◆' : '◇';
  el('#pin').setAttribute('aria-pressed', String(s.pinned));
  root.style.setProperty(
    '--progress',
    String(s.seconds / (s.durations[s.mode] * 60)),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === s.mode);
    b.setAttribute('aria-pressed', String(b.dataset.mode === s.mode));
  });
}
for (const type of ['toggle', 'reset', 'pin', 'side'] as const)
  el(`#${type}`).onclick = () => window.timer.command({ type });
root
  .querySelectorAll<HTMLButtonElement>('[data-mode]')
  .forEach(
    (b) =>
      (b.onclick = () =>
        window.timer.command({ type: 'mode', mode: b.dataset.mode as Mode })),
  );
const form = el<HTMLFormElement>('.settings');
function closeSettings() {
  if (!soundPanel.hidden) ambience.close();
  soundPanel.hidden = true;
  form.hidden = true;
  settingsOpen = false;
  if (restorePin) window.timer.command({ type: 'pin' });
}
function openPanel(panel: HTMLElement) {
  if (!state) return;
  settingsOpen = true;
  restorePin = !state.pinned;
  if (restorePin) window.timer.command({ type: 'pin' });
  panel.hidden = false;
}
el('#sound').onclick = () => {
  openPanel(soundPanel);
  soundPanel.querySelector('select')!.focus();
};
el('#close-sound').onclick = closeSettings;
el('#settings').onclick = () => {
  if (!state) return;
  openPanel(form);
  for (const mode of ['focus', 'short', 'long'] as const)
    el<HTMLInputElement>(`input[name="${mode}"]`).value = String(
      state.durations[mode],
    );
  form.hidden = false;
  el<HTMLInputElement>('input').focus();
};
el('#close-settings').onclick = closeSettings;
form.onsubmit = (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const durations = Object.fromEntries(
    new FormData(form).entries().map(([k, v]) => [k, Number(v)]),
  ) as Record<Mode, number>;
  window.timer.command({ type: 'durations', durations });
  closeSettings();
};
root.onkeydown = (event) => {
  if (event.key === 'Escape' && settingsOpen) closeSettings();
};
let dragging = false;
root.onpointerdown = (event) => {
  if (
    event.button !== 0 ||
    settingsOpen ||
    (!(event.target as HTMLElement).closest('#drag') && !event.altKey)
  )
    return;
  event.preventDefault();
  root.setPointerCapture(event.pointerId);
  dragging = true;
  window.timer.command({ type: 'drag-start' });
};
function endDrag() {
  if (dragging) {
    dragging = false;
    window.timer.command({ type: 'drag-end' });
  }
}
root.onpointerup = endDrag;
root.onpointercancel = endDrag;
root.onlostpointercapture = endDrag;
window.addEventListener('blur', endDrag);
window.timer.subscribe(render);
void window.timer.snapshot().then(render);
