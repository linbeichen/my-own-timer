import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
  Notification,
  shell,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import {
  initialTimer,
  restoreTimer,
  secondsLeft,
  toggleTimer,
  selectMode,
  finishTimer,
} from './timer';
import type { Command, Side, Snapshot } from './shared';

let win: BrowserWindow;
let tray: Tray;
let timer = initialTimer();
let side: Side = 'right';
let position = 0.5;
let displayId: number;
let expanded = false;
let pinned = false;
let dragging = false;
let dragOffset = 0;
let lastInside = 0;
let ignoring = false;
let poll: ReturnType<typeof setInterval>;
let ticker: ReturnType<typeof setInterval>;
const WIDTH = 320,
  HEIGHT = 400;
const statePath = () => path.join(app.getPath('userData'), 'timer-state.json');
const snapshot = (): Snapshot => ({
  ...timer,
  seconds: secondsLeft(timer),
  expanded,
  side,
  pinned,
});
function publish() {
  if (win && !win.isDestroyed())
    win.webContents.send('timer:state', snapshot());
  if (tray)
    tray.setToolTip(
      `My Own Timer · ${Math.floor(secondsLeft(timer) / 60)} 分钟`,
    );
}
function save() {
  try {
    const file = statePath();
    fs.writeFileSync(
      `${file}.tmp`,
      JSON.stringify({ timer, side, position, displayId }),
    );
    fs.renameSync(`${file}.tmp`, file);
  } catch (error) {
    console.error('无法保存计时状态', error);
  }
}
function place() {
  const display =
    screen.getAllDisplays().find((d) => d.id === displayId) ??
    screen.getPrimaryDisplay();
  displayId = display.id;
  const b = display.bounds;
  win.setBounds({
    x: side === 'right' ? b.x + b.width - WIDTH : b.x,
    y: Math.round(
      display.workArea.y +
        Math.max(0, display.workArea.height - HEIGHT) * position,
    ),
    width: WIDTH,
    height: HEIGHT,
  });
}
function setExpanded(value: boolean) {
  if (expanded === value) return;
  expanded = value;
  publish();
}
function inspectPointer() {
  if (!win || win.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  if (dragging) {
    const display = screen.getDisplayNearestPoint(cursor);
    displayId = display.id;
    position = Math.max(
      0,
      Math.min(
        1,
        (cursor.y - dragOffset - display.workArea.y) /
          Math.max(1, display.workArea.height - HEIGHT),
      ),
    );
    place();
    return;
  }
  const b = win.getBounds();
  const width = expanded ? 304 : 36;
  const height = expanded ? 380 : 110;
  const x = side === 'right' ? b.x + WIDTH - width : b.x;
  const y = b.y + (HEIGHT - height) / 2;
  // Rounded inner corners are transparent too; do not intercept clicks there.
  const lx = side === 'right' ? cursor.x - x : x + width - cursor.x;
  const ly = cursor.y - y;
  const radius = expanded ? 24 : 16;
  let inside = lx >= 0 && lx < width && ly >= 0 && ly < height;
  if (inside && lx < radius && (ly < radius || ly > height - radius)) {
    const cy = ly < radius ? radius : height - radius;
    inside = (lx - radius) ** 2 + (ly - cy) ** 2 <= radius ** 2;
  }
  if (inside) {
    lastInside = Date.now();
    setExpanded(true);
  } else if (!pinned && Date.now() - lastInside > 450) setExpanded(false);
  if (ignoring !== !inside) {
    ignoring = !inside;
    win.setIgnoreMouseEvents(ignoring, { forward: true });
  }
}
function reveal() {
  lastInside = Date.now() + 1500;
  setExpanded(true);
  win.showInactive();
}
function command(c: Command) {
  if (!c || typeof c !== 'object') return;
  switch (c.type) {
    case 'toggle':
      toggleTimer(timer);
      break;
    case 'reset':
      selectMode(timer, timer.mode);
      break;
    case 'mode':
      if (['focus', 'short', 'long'].includes(c.mode))
        selectMode(timer, c.mode);
      break;
    case 'durations': {
      const d = c.durations;
      if (
        !d ||
        ![d.focus, d.short, d.long].every(
          (v) => Number.isInteger(v) && v >= 1 && v <= 180,
        )
      )
        return;
      timer.durations = { focus: d.focus, short: d.short, long: d.long };
      selectMode(timer, timer.mode);
      break;
    }
    case 'pin':
      pinned = !pinned;
      lastInside = Date.now();
      break;
    case 'side':
      side = side === 'right' ? 'left' : 'right';
      place();
      lastInside = Date.now() + 1000;
      break;
    case 'drag-start':
      dragging = true;
      dragOffset = screen.getCursorScreenPoint().y - win.getBounds().y;
      break;
    case 'drag-end':
      dragging = false;
      lastInside = Date.now();
      break;
    case 'quit':
      app.quit();
      return;
    default:
      return;
  }
  save();
  publish();
}
if (started || !app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => {
    try {
      const saved = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
      timer = restoreTimer(saved.timer);
      side = saved.side === 'left' ? 'left' : 'right';
      if (Number.isFinite(saved.position))
        position = Math.max(0, Math.min(1, saved.position));
      displayId = saved.displayId;
    } catch {
      /* First run or invalid state: use defaults. */
    }
    win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      type: 'panel',
      show: false,
      acceptFirstMouse: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin')
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    place();
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    ipcMain.handle('timer:snapshot', (event) =>
      event.sender === win.webContents ? snapshot() : null,
    );
    ipcMain.on('timer:command', (event, c: Command) => {
      if (event.sender === win.webContents) command(c);
    });
    win.on('blur', () => {
      if (dragging) command({ type: 'drag-end' });
    });
    win.once('ready-to-show', () => {
      win.showInactive();
      publish();
    });
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL)
      void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    else
      void win.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    // A template PNG renders correctly in both light and dark menu bars.
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAiElEQVR4nO3UUQrAMAgD0N7/0tsJuiYxMisG+jVNHxS2VpM84BlQGdDklDJPhkLSYSokBXYqZr6FUUgh+z2EQkrQy8Ig5SLHXHg5a3a7yMyy83eC2AXlGaj5diDkLz2gX0FK7gZJC5mY8iAnKtTrRln6skCWErXM0WErtGO+ipVjTxmICpv0zwswSUjGlILmGgAAAABJRU5ErkJggg==',
    );
    icon.setTemplateImage(true);
    tray = new Tray(icon.resize({ width: 18, height: 18 }));

    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示番茄钟', click: reveal },
        { label: '开始 / 暂停', click: () => command({ type: 'toggle' }) },
        { label: '切换停靠边缘', click: () => command({ type: 'side' }) },
        { type: 'separator' },
        { label: '退出 My Own Timer', click: () => app.quit() },
      ]),
    );
    tray.on('click', reveal);
    app.dock?.hide();
    const displaysChanged = () => {
      place();
      save();
    };
    screen.on('display-added', displaysChanged);
    screen.on('display-removed', displaysChanged);
    screen.on('display-metrics-changed', displaysChanged);
    poll = setInterval(inspectPointer, 40);
    ticker = setInterval(() => {
      const wasFocus = timer.mode === 'focus';
      if (finishTimer(timer)) {
        save();
        shell.beep();
        reveal();
        if (Notification.isSupported())
          new Notification({
            title: wasFocus ? '专注完成，休息一下' : '休息结束，准备开始',
            body: '下一阶段已准备好，点击开始继续。',
            silent: true,
          }).show();
      }
      publish();
    }, 250);
    app.on('activate', reveal);
    app.on('second-instance', reveal);
  });
}
app.on('before-quit', () => {
  clearInterval(poll);
  clearInterval(ticker);
  if (win) save();
});
app.on('window-all-closed', () => app.quit());
