/**
 * CineForge Pro — Electron Preload Script
 * Exposes safe native APIs to the renderer via contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron');

// ─── Expose APIs to renderer ───
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // File system
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', { filePath, data }),
  getPath: (type) => ipcRenderer.invoke('file:getPath', type),

  // Window
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getGPUInfo: () => ipcRenderer.invoke('gpu:info'),

  // Shell
  showInFolder: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

  // Listen for menu events from main process
  onMenuAction: (callback) => ipcRenderer.on('menu:action', (_, action) => callback(action)),
  onMenuPage: (callback) => ipcRenderer.on('menu:page', (_, page) => callback(page)),
  onUpdateEvent: (callback) => ipcRenderer.on('update:available', (_, info) => callback('available', info)),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
