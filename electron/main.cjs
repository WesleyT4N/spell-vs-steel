// Desktop shell: one window around the player build (dist-prod/index.html). Saves land in Electron's
// own storage for the app (localStorage under the user's app-data folder), so they survive updates.
// Online room codes go over PeerJS like any hosted build; the lobby, ranked and tournaments still need
// the claude.ai page and say so.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#000000',
    title: 'Spell VS Steel',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // an online match is lockstep: an alt-tabbed window must keep stepping at full speed
      backgroundThrottling: false,
    },
  });
  win.removeMenu();

  // F11 or Alt+Enter toggles fullscreen
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });

  // the game never navigates; anything that tries opens in the real browser instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  win.loadFile(path.join(__dirname, '..', 'dist-prod', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
