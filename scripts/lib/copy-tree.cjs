/**
 * Copy a directory tree, following symlinks (pnpm virtual store) without
 * looping. The same real directory may be copied to multiple destinations.
 */
const fs = require("fs");
const path = require("path");

function copyTree(src, dest) {
  if (!src || !fs.existsSync(src)) {
    throw new Error(`copyTree: missing ${src}`);
  }
  walk(src, dest, new Set());
}

function walk(from, to, stack) {
  let real;
  try {
    real = fs.realpathSync(from);
  } catch {
    return;
  }
  if (stack.has(real)) return;
  let st;
  try {
    st = fs.statSync(real);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    const next = new Set(stack);
    next.add(real);
    let names;
    try {
      names = fs.readdirSync(real);
    } catch {
      return;
    }
    for (const name of names) {
      walk(path.join(real, name), path.join(to, name), next);
    }
    return;
  }
  if (st.isFile()) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(real, to);
  }
}

module.exports = { copyTree };
