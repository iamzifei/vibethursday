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
  // Build Tuesday, 3 November (2026-11-04): five of the day's photos, redrawn
  // like the rest. One with a product's revenue numbers on screen was left out.
  "2026-11-03": [
    { src: "/photos/session-1103-1", alt: { zh: "一张长桌坐满了人，都打开着电脑，旁边的屏幕亮着", en: "A long table full of people with laptops open, a screen lit up beside them" }, width: 1600, height: 1200 },
    { src: "/photos/session-1103-2", alt: { zh: "两个人对着屏幕上的页面讨论，其中一人拿着手机", en: "Two people talking over a page on the screen, one holding a phone" }, width: 1600, height: 1200 },
    { src: "/photos/session-1103-3", alt: { zh: "有人坐在屏幕前讲自己的项目，大家围着听", en: "Someone at the screen walking through their project while the others listen" }, width: 1600, height: 1200 },
    { src: "/photos/session-1103-4", alt: { zh: "屏幕前有人在演示，大家笑着讨论", en: "A demo at the screen, everyone laughing as they talk it through" }, width: 1600, height: 1200 },
    { src: "/photos/session-1103-5", alt: { zh: "散场后一起吃午饭，一张圆桌坐满了人", en: "Lunch together afterwards, a round table full of people" }, width: 1600, height: 1200 },
  ],
  "2026-10-15": [
    { src: "/photos/session-1015-1", alt: { zh: "有人坐在高脚凳上拿着话筒分享，旁边的屏幕放着他的页面", en: "Someone on a stool with a microphone, their slides on the screen beside them" }, width: 900, height: 1600 },
    { src: "/photos/session-1015-2", alt: { zh: "玻璃顶棚下坐满了人，大家朝着前面听", en: "A full room under the glass roof, everyone facing the front" }, width: 1600, height: 900 },
    { src: "/photos/session-1015-3", alt: { zh: "从后排看过去的整个场地", en: "The whole room, seen from the back" }, width: 1600, height: 900 },
    { src: "/photos/session-1015-4", alt: { zh: "几张桌子围坐的人在听分享", en: "People around several tables, listening to a talk" }, width: 1600, height: 900 },
  ],
};
