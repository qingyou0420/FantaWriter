const { contextBridge, ipcRenderer } = require("electron");

const desktopBridge = {
  isDesktop: true,
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  checkUpdate: () => ipcRenderer.invoke("app:checkUpdate"),
  installUpdate: (installerPath) =>
    ipcRenderer.invoke("app:installUpdate", installerPath),
  pickInstaller: () => ipcRenderer.invoke("app:pickInstaller"),
  openPath: (target) => ipcRenderer.invoke("app:openPath", target),
  openUpdateDir: () => ipcRenderer.invoke("app:openUpdateDir"),
};

contextBridge.exposeInMainWorld("eroticNovelStudio", desktopBridge);
contextBridge.exposeInMainWorld("fantasyWriter", desktopBridge);
