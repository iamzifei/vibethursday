/**
 * Photos for mornings that have no write-up in `content.ts` yet (2026-11-02),
 * redrawn in a hand-painted style with every face replaced, like the other
 * photos the site publishes. Keyed by date; `buildArchive` attaches them to
 * that morning's row, with the alt text in the page's language.
 *
 * Files are in /public/photos at the same widths as the written sessions'.
 */
export type SessionPhoto = { src: string; alt: { zh: string; en: string }; width: number; height: number };

export const EXTRA_SESSION_PHOTOS: Readonly<Record<string, readonly SessionPhoto[]>> = {
  "2026-10-15": [
    { src: "/photos/session-1015-1", alt: { zh: "有人坐在高脚凳上拿着话筒分享，旁边的屏幕放着他的页面", en: "Someone on a stool with a microphone, their slides on the screen beside them" }, width: 900, height: 1600 },
    { src: "/photos/session-1015-2", alt: { zh: "玻璃顶棚下坐满了人，大家朝着前面听", en: "A full room under the glass roof, everyone facing the front" }, width: 1600, height: 900 },
    { src: "/photos/session-1015-3", alt: { zh: "从后排看过去的整个场地", en: "The whole room, seen from the back" }, width: 1600, height: 900 },
    { src: "/photos/session-1015-4", alt: { zh: "几张桌子围坐的人在听分享", en: "People around several tables, listening to a talk" }, width: 1600, height: 900 },
  ],
};
