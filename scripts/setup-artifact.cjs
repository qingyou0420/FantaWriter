/**
 * 开发期入口：转发给打进 asar 的 packages/desktop/lib/setup-artifact.cjs。
 * publish-update.mjs 与单测仍 require 本文件。
 */
module.exports = require("../packages/desktop/lib/setup-artifact.cjs");
