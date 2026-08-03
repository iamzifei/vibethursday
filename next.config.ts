import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately NOT `output: "standalone"`. Zeabur's Node.js builder starts
  // the app with `next start`, which refuses to serve a standalone build — the
  // option would be silently ignored while still emitting a warning on boot.

  // `pg` opens raw TCP sockets, so it has to run as a real Node module rather
  // than be traced into the server bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
