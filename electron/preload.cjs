// Conta para o Mini SK que ele está no PC (terminal e ponte já ligados pelo programa).
const { contextBridge, ipcRenderer } = require('electron');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : ''; };
const portas = (arg('minisk-portas') || '7680,7681,7682').split(',').map(Number);
contextBridge.exposeInMainWorld('miniskPC', { codigo: arg('minisk-codigo'), pasta: arg('minisk-pasta'), so: process.platform, portas: { app: portas[0], terminal: portas[1], ponte: portas[2] }, ligarOllama: () => ipcRenderer.invoke('ligar-ollama'), desligarOllama: () => ipcRenderer.invoke('desligar-ollama'), abrirPasta: (p) => ipcRenderer.invoke('abrir-pasta', p) });
