import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately NOT `output: "standalone"`. Zeabur's Node.js builder starts
  // the app with `next start`, which refuses to serve a standalone build — the
  // option would be silently ignored while still emitting a warning on boot.

  // `pg` opens raw TCP sockets, so it has to run as a real Node module rather
  // than be traced into the server bundle.
  serverExternalPackages: ["pg"],

  /**
   * Long-lived caching for the static files in `public/`.
   *
   * Next ships them with `max-age=0`, so every repeat visit spends a round trip
   * revalidating a photo that has not changed since it was taken. These have no
   * build hash in their filenames, so this stops short of `immutable`: thirty
   * days is long enough to make repeat visits free and short enough that
   * replacing a file in place heals on its own.
   */
  async headers() {
    return [
      {
        source: "/photos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/:file(og.jpg|wechat-qr.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
    ];
  },
};

export default nextConfig;
