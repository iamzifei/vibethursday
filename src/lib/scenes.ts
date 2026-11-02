/**
 * Scenes from past Thursdays, redrawn (2026-11-02) from the organiser's photos
 * in a hand-painted animation style with every face replaced, so they show how
 * full and how focused the mornings are without showing anyone. Files live in
 * /public/scenes at two widths (640 for phones, 1200 for wide screens).
 */
export type Scene = { id: string; zh: string; en: string };

export const SCENES: readonly Scene[] = [
  { id: "scene-1", zh: "9 月 · 长桌坐满，电脑都打开着", en: "September · a full table, laptops open" },
  { id: "scene-2", zh: "8 月 · Darling Harbour，站着分享", en: "August · Darling Harbour, a talk from the floor" },
  { id: "scene-3", zh: "8 月 · 一张长桌从头坐到尾", en: "August · one long table, end to end" },
  { id: "scene-4", zh: "9 月 · 满场", en: "September · a full room" },
  { id: "scene-5", zh: "9 月 · 分桌讨论", en: "September · talking it through in groups" },
];

/**
 * The 10-25 class, redrawn the same way (2026-11-02), for /class. The
 * projected slide in class-2 is blurred on purpose.
 */
export const CLASS_SCENES: readonly Scene[] = [
  { id: "class-1", zh: "10 月 25 日 · 上一期，全场对着同一页讲义", en: "25 October · the last class, the whole room on one slide" },
  { id: "class-2", zh: "边听边在电脑上跟着做", en: "Following along on laptops" },
  { id: "class-3", zh: "坐满的教室", en: "A full room" },
  { id: "class-4", zh: "分组动手", en: "Working it through in groups" },
];

export function sceneSrc(id: string, width: 640 | 1200): string {
  return `/scenes/${id}-${width}.webp`;
}
