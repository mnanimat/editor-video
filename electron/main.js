/**
 * CineForge Pro — Electron Main Process
 * Windows desktop application wrapper
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const isDev = process.argv.includes('--dev');

let mainWindow = null;

// ─── App Ready ───
app.whenReady().then(() => {
  createMainWindow();
  setupAutoUpdater();
  setupProtocol();
  setupMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Main Window ───
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0d0d0f',
    show: false,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Allow local file access for video
      allowRunningInsecureContent: false,
      experimentalFeatures: true, // Enable WebGL2
      hardwareAcceleration: true,
    },
    icon: path.join(__dirname, '../icons/icon.ico'),
  });

  // Load the app
  const indexPath = path.join(__dirname, '../index.html');
  mainWindow.loadFile(indexPath);

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Handle close
  mainWindow.on('close', (e) => {
    if (isDev) return; // Skip prompt in dev
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Sair', 'Cancelar'],
      title: 'CineForge Pro',
      message: 'Deseja sair? Alterações não salvas serão perdidas.',
      defaultId: 1,
    });
    if (choice === 1) e.preventDefault();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // External links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ─── IPC Handlers ───
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Selecionar Arquivo',
    filters: options.filters || [
      { name: 'Mídia', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'aac', 'png', 'jpg', 'jpeg', 'gif', 'webp'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ],
    properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  });
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Salvar Arquivo',
    defaultPath: options.defaultPath || 'output.mp4',
    filters: options.filters || [
      { name: 'Vídeo MP4', extensions: ['mp4'] },
      { name: 'Vídeo WebM', extensions: ['webm'] },
      { name: 'Projeto CineForge', extensions: ['cineforge'] },
    ],
  });
  return result.filePath;
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:write', async (event, { filePath, data }) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:getPath', async (event, type) => {
  const { app: electronApp } = require('electron');
  return electronApp.getPath(type); // 'documents', 'videos', 'pictures', etc.
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('shell:openPath', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// Fullscreen toggle
ipcMain.handle('window:toggleFullscreen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

// GPU info for status bar
ipcMain.handle('gpu:info', async () => {
  const info = await app.getGPUInfo('basic');
  return info;
});

// ─── Protocol Handler (for local file:// media) ───
function setupProtocol() {
  protocol.interceptFileProtocol('file', (request, callback) => {
    let url = request.url.slice(7); // Remove 'file://'
    url = decodeURIComponent(url);
    callback({ path: url });
  });
}

// ─── Application Menu ───
function setupMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo Projeto', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:action', 'new-project') },
        { label: 'Abrir Projeto...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:action', 'open-project') },
        { label: 'Salvar Projeto', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:action', 'save-project') },
        { label: 'Salvar Como...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu:action', 'save-as') },
        { type: 'separator' },
        { label: 'Importar Mídia...', accelerator: 'CmdOrCtrl+I', click: () => mainWindow.webContents.send('menu:action', 'import-media') },
        { label: 'Importar LUT (.cube)...', click: () => mainWindow.webContents.send('menu:action', 'import-lut') },
        { type: 'separator' },
        { label: 'Exportar Vídeo...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu:action', 'export') },
        { label: 'Exportar Frame Atual', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.send('menu:action', 'export-frame') },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu:action', 'undo') },
        { label: 'Refazer', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu:action', 'redo') },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { type: 'separator' },
        { label: 'Selecionar Tudo', accelerator: 'CmdOrCtrl+A', click: () => mainWindow.webContents.send('menu:action', 'select-all') },
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Tela Cheia', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Scopes', accelerator: 'CmdOrCtrl+Shift+W', click: () => mainWindow.webContents.send('menu:action', 'toggle-scopes') },
        { label: 'Áreas Seguras', accelerator: 'CmdOrCtrl+Shift+A', click: () => mainWindow.webContents.send('menu:action', 'toggle-safe-zones') },
        { type: 'separator' },
        { label: 'Página: Editar',   accelerator: 'F1', click: () => mainWindow.webContents.send('menu:page', 'edit') },
        { label: 'Página: Cor',      accelerator: 'F2', click: () => mainWindow.webContents.send('menu:page', 'color') },
        { label: 'Página: Efeitos',  accelerator: 'F3', click: () => mainWindow.webContents.send('menu:page', 'effects') },
        { label: 'Página: Motion',   accelerator: 'F4', click: () => mainWindow.webContents.send('menu:page', 'motion') },
        { label: 'Página: Áudio',    accelerator: 'F5', click: () => mainWindow.webContents.send('menu:page', 'audio') },
        { label: 'Página: Entrega',  accelerator: 'F6', click: () => mainWindow.webContents.send('menu:page', 'export') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'DevTools' },
      ]
    },
    {
      label: 'Efeitos',
      submenu: [
        { label: 'Color Grade...', click: () => mainWindow.webContents.send('menu:page', 'color') },
        { label: 'Adicionar Efeito...', click: () => mainWindow.webContents.send('menu:page', 'effects') },
        { type: 'separator' },
        { label: 'Chroma Key (Green Screen)', click: () => mainWindow.webContents.send('menu:action', 'add-effect:chromakey') },
        { label: 'Grão de Filme', click: () => mainWindow.webContents.send('menu:action', 'add-effect:filmgrain') },
        { label: 'Vinheta', click: () => mainWindow.webContents.send('menu:action', 'add-effect:vignette') },
        { label: 'Glitch', click: () => mainWindow.webContents.send('menu:action', 'add-effect:glitch') },
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Sobre CineForge Pro', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'CineForge Pro',
            message: 'CineForge Pro v1.0.0',
            detail: 'Editor de Vídeo Cinematográfico\nWebGL 2.0 • Web Audio API • PWA\n\nDesenvolvido com ❤️ e tecnologia de ponta',
            buttons: ['OK'],
          });
        }},
        { label: 'Verificar Atualizações', click: () => autoUpdater.checkForUpdatesAndNotify() },
        { type: 'separator' },
        { label: 'Abrir Pasta de Dados', click: () => shell.openPath(app.getPath('userData')) },
      ]
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── Auto Updater ───
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.setProgressBar(progress.percent / 100);
    mainWindow?.webContents.send('update:progress', progress);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.setProgressBar(-1);
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: 'Atualização disponível',
      message: 'Uma nova versão foi baixada. Reiniciar para instalar?',
      buttons: ['Reiniciar agora', 'Mais tarde'],
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Check for updates after 3 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 3000);
}
