const { contextBridge, ipcRenderer } = require("electron");

const desktopBridge = {
  isDesktop: true,
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getUpdateSettings: () => ipcRenderer.invoke("app:getUpdateSettings"),
  setGithubUpdateToken: (token) =>
    ipcRenderer.invoke("app:setGithubUpdateToken", token),
  checkUpdate: (opts) => ipcRenderer.invoke("app:checkUpdate", opts),
  downloadUpdate: (opts) => ipcRenderer.invoke("app:downloadUpdate", opts),
  installUpdate: (installerPath) =>
    ipcRenderer.invoke("app:installUpdate", installerPath),
  pickInstaller: () => ipcRenderer.invoke("app:pickInstaller"),
  openPath: (target) => ipcRenderer.invoke("app:openPath", target),
  openUpdateDir: () => ipcRenderer.invoke("app:openUpdateDir"),
  pickDirectory: (opts) => ipcRenderer.invoke("fs:pickDirectory", opts || {}),
  writeTextFiles: (payload) => ipcRenderer.invoke("fs:writeTextFiles", payload),
  listTextFiles: (payload) => ipcRenderer.invoke("fs:listTextFiles", payload),
  writeDesktopBackup: (payload) =>
    ipcRenderer.invoke("fs:writeDesktopBackup", payload),
  openBackupDir: () => ipcRenderer.invoke("app:openBackupDir"),
  getSuggestedExportRoot: () => ipcRenderer.invoke("fs:getSuggestedExportRoot"),
};

contextBridge.exposeInMainWorld("fantasyWriter", desktopBridge);
