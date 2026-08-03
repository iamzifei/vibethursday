import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zeabur builds this into a container. `standalone` emits a self-contained
  // server with only the dependencies actually reached at runtime, which keeps
  // the image small enough to sit comfortably on a shared 4GB host.
  output: "standalone",

  // `pg` opens raw TCP sockets, so it has to run as a real Node module rather
  // than be traced into the server bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
