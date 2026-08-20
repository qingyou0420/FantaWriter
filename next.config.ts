import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Electron 打包用 standalone 服务
  output: "standalone",
  // 避免上级目录存在 package-lock.json 时，Next 误把工作区根目录指到别处
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;
