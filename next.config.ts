import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately NOT `output: "standalone"`. Zeabur's Node.js builder starts
  // the app with `next start`, which refuses to serve a standalone build — the
  // option would be silently ignored while still emitting a warning on boot.

  // `pg` opens raw TCP sockets, so it has to run as a real Node module rather
  // than be traced into the server bundle.
  serverExternalPackages: ["pg"],

  /**
   * Dev server only: let a phone or another laptop on the same Wi-Fi load the
   * page. /play is a phone game and has to be tried on a phone, and without
   * this Next 16 blocks the dev scripts for any host but localhost — the page
   * renders but never hydrates, so every button is dead and the dev client
   * keeps retrying. Measured 2026-09-25 by opening /play at the LAN address.
   * Private address ranges only; this setting does nothing in production.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],

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
        /**
         * Security headers, on every response.
         *
         * ⚠️ Until 2026-09-24 there were none at all — measured with `curl -I`
         * against the live site: no HSTS, no nosniff, no frame protection, no
         * referrer policy, no permissions policy, no CSP. The one with a real
         * consequence was framing: /admin could be embedded in somebody else's
         * page and its check-in and publish buttons clicked through a decoy.
         *
         * The CSP is REPORT-ONLY on purpose. Next injects inline scripts for
         * its own runtime, and an enforced policy written blind would break the
         * site in a way no test here would catch. Report-only lets violations
         * show up in the console first; tighten it once there are none.
         * `frame-ancestors` is ignored in report-only mode by spec, which is
         * exactly why X-Frame-Options is set separately and enforced.
         *
         * Cloudflare Turnstile (the sign-up bot check) is the only third party
         * the site loads — measured by recording every request on /, /members
         * and /wharf.
         */
        source: "/:path*",
        headers: [
          // A year, and deliberately without includeSubDomains or preload:
          // both are hard to walk back, and nothing else lives on this domain.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              // data: for the QR codes the poster and badge draw from an inline SVG.
              "img-src 'self' data: blob: https://challenges.cloudflare.com",
              "font-src 'self'",
              "connect-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
              "frame-src https://challenges.cloudflare.com",
              // The PDF renderer on the projector page runs a same-origin worker.
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/photos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        // The game's music. Same reasoning as the photos: no hash in the
        // name, so thirty days rather than immutable.
        source: "/audio/:path*",
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
