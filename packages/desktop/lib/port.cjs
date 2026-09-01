/**
 * Scan-and-pin loopback ports. Never default to InkOS CLI's 4567.
 */
const net = require("net");

const HOST = "127.0.0.1";
const SCAN_START = 17831;
const FORBIDDEN = new Set([4567, 4568]);

function canBindPort(port, host = HOST) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

function normalizePinnedPort(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n >= 65536) return null;
  if (FORBIDDEN.has(n)) return null;
  return n;
}

async function pickListenPort(start = SCAN_START) {
  const from = normalizePinnedPort(start) ?? SCAN_START;
  let port = from;
  for (let i = 0; i < 40; i++) {
    if (!FORBIDDEN.has(port) && (await canBindPort(port))) {
      return port;
    }
    port += 1;
    if (FORBIDDEN.has(port)) port += 1;
  }
  throw new Error(`端口 ${from}–${port} 均被占用，无法启动引擎`);
}

module.exports = {
  HOST,
  SCAN_START,
  FORBIDDEN,
  canBindPort,
  normalizePinnedPort,
  pickListenPort,
};
