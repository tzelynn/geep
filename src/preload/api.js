'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('geep', {
  role: process.argv.find((a) => a.startsWith('--geep-role='))?.split('=')[1] || 'unknown',
  onState: (fn) => {
    const handler = (_e, state) => fn(state)
    ipcRenderer.on('geep:state', handler)
    ipcRenderer.send('geep:ready')
    return () => ipcRenderer.removeListener('geep:state', handler)
  },
  onConfig: (fn) => {
    const handler = (_e, cfg) => fn(cfg)
    ipcRenderer.on('geep:config', handler)
    return () => ipcRenderer.removeListener('geep:config', handler)
  },
  action: (type, payload) => ipcRenderer.send('geep:action', { type, payload }),
  getConfig: () => ipcRenderer.invoke('geep:get-config'),
  saveConfig: (patch) => ipcRenderer.invoke('geep:save-config', patch),
  setExceptions: (list) => ipcRenderer.invoke('geep:set-exceptions', list),
  getState: () => ipcRenderer.invoke('geep:get-state'),
  // the overlay tells main when it wants to swallow clicks
  setClickBlocking: (on) => ipcRenderer.send('geep:click-blocking', !!on)
})
