/**
 * Desktop project-root helpers. The engine must receive an explicit root;
 * this module never uses process.cwd() as the product root.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_FOLDER = "幻想作家";

function defaultProjectRoot(documentsDir) {
  const documents = documentsDir || path.join(os.homedir(), "Documents");
  return path.join(documents, DEFAULT_FOLDER);
}

function isAbsoluteRoot(root) {
  const value = String(root || "").trim();
  if (!value) return false;
  return path.isAbsolute(value);
}

function ensureProjectLayout(root) {
  if (!isAbsoluteRoot(root)) {
    throw new Error("Project root must be an absolute path");
  }
  const resolved = path.resolve(root);
  fs.mkdirSync(path.join(resolved, "books"), { recursive: true });
  fs.mkdirSync(path.join(resolved, ".inkos"), { recursive: true });

  const configPath = path.join(resolved, "inkos.json");
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          name: path.basename(resolved) || "幻想作家",
          version: "0.1.0",
          language: "zh",
          llm: {
            provider: "openai",
            service: "custom",
            configSource: "studio",
            baseUrl: "",
            model: "",
            apiFormat: "chat",
            stream: true,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  const gitignorePath = path.join(resolved, ".gitignore");
  const required = [".env", ".inkos/secrets.json", "node_modules/", ".DS_Store"];
  let existing = "";
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, "utf8");
  }
  const have = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
  const missing = required.filter((entry) => !have.has(entry));
  if (!existing) {
    fs.writeFileSync(gitignorePath, `${required.join("\n")}\n`, "utf8");
  } else if (missing.length) {
    const sep = existing.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(gitignorePath, `${existing}${sep}${missing.join("\n")}\n`, "utf8");
  }
  return resolved;
}

function writeSecrets(root, service, apiKey) {
  const dir = path.join(root, ".inkos");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "secrets.json");
  let data = { services: {} };
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!data || typeof data !== "object" || !data.services) data = { services: {} };
    } catch {
      data = { services: {} };
    }
  }
  const id = String(service || "custom").trim() || "custom";
  const key = String(apiKey || "").trim();
  if (key) data.services[id] = { apiKey: key };
  else delete data.services[id];
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

function writeProjectLlm(root, opts) {
  const configPath = path.join(root, "inkos.json");
  let raw = {};
  if (fs.existsSync(configPath)) {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  raw.name = raw.name || path.basename(root) || "幻想作家";
  raw.version = raw.version || "0.1.0";
  raw.language = raw.language || "zh";
  raw.llm = {
    ...(raw.llm && typeof raw.llm === "object" ? raw.llm : {}),
    provider: "openai",
    service: "custom",
    configSource: "studio",
    baseUrl: String(opts.baseUrl || "").trim(),
    model: String(opts.model || "").trim(),
    apiFormat: "chat",
    stream: true,
  };
  fs.writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  return configPath;
}

module.exports = {
  DEFAULT_FOLDER,
  defaultProjectRoot,
  isAbsoluteRoot,
  ensureProjectLayout,
  writeSecrets,
  writeProjectLlm,
};
