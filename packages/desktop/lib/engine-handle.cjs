/**
 * Track a Studio engine the shell spawned or adopted.
 * Quit/restart must kill either kind — an adopted engine has no ChildProcess.
 */
function emptyEngineHandle() {
  return { child: null, pid: 0, port: 0, token: "" };
}

function hasLiveEngine(handle) {
  return Boolean(handle && (handle.child || handle.pid > 0 || handle.port > 0));
}

function engineKillPid(handle) {
  if (!handle) return 0;
  const childPid = Number(handle.child?.pid) || 0;
  if (childPid > 0) return childPid;
  return Number(handle.pid) || 0;
}

function adoptEngine(handle, health, port) {
  const pid = Number(health?.pid);
  if (!health?.ok || !Number.isInteger(pid) || pid <= 0) {
    throw new Error("cannot adopt engine: health.pid is required");
  }
  handle.child = null;
  handle.pid = pid;
  handle.port = port;
  handle.token = String(health.instanceToken || "");
  return handle;
}

function attachSpawnedEngine(handle, child, port, token) {
  handle.child = child;
  handle.pid = Number(child?.pid) || 0;
  handle.port = port;
  handle.token = token || "";
  return handle;
}

function clearEngineHandle(handle) {
  handle.child = null;
  handle.pid = 0;
  handle.port = 0;
  handle.token = "";
  return handle;
}

function shouldStopEngine(handle) {
  return hasLiveEngine(handle);
}

module.exports = {
  emptyEngineHandle,
  hasLiveEngine,
  engineKillPid,
  adoptEngine,
  attachSpawnedEngine,
  clearEngineHandle,
  shouldStopEngine,
};
