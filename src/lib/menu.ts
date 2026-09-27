// Relative imports only in this file's dependents: the tests load it through
// Node's type stripper, which cannot resolve the tsconfig path alias.

/**
 * The drinks list for the pre-order page, and the only thing that changes when
 * the venue does.
 *
 * ★ Data, not code. When the meetup moves, this object is swapped for the new
 * venue's drinks and nothing else is touched: the page, the route, the admin
 * sheet and the tests all read it. Orders store their own copy of the name and
 * price at the moment they were placed, so replacing this list never rewrites
 * what somebody already ordered.
 *
 * Drinks only, on purpose. The point of pre-ordering is that the bar can take
 * payment by name and start making coffee the moment the doors open; food
 * orders are rare, slower, and can be made at the counter as usual.
 *
 * Every variant is its own item rather than an option on a parent (tea type,
 * juice flavour, milkshake flavour). The page is a plain HTML form so it works
 * in whatever browser WeChat opens it in, and a second-level choice that
 * depends on the first one needs script to show the right options. Size is the
 * one shared choice, and it only applies to items that have two prices.
 */

/** Prices are integer cents, so totals never pick up floating-point error. */
export type Price = number | { small: number; large: number };

export type MenuItem = {
  /** Stable key, stored on the order row. Never reuse an id for a different drink. */
  id: string;
  /** What the bar calls it. English, because that is what goes on the sheet for the barista. */
  name: string;
  /** A Chinese hint shown next to the name on the page. */
  zh: string;
  category: MenuCategoryId;
  price: Price;
};

export type MenuCategoryId = "coffee" | "tea" | "iced" | "juice" | "signature" | "milkshake";

export type Menu = {
  /** Printed on the page, so people know which café's list they are looking at. */
  venue: string;
  /** Category order and labels, as the page shows them. */
  categories: { id: MenuCategoryId; zh: string; en: string }[];
  items: MenuItem[];
};

/**
 * The Avenue, Chatswood — all-day menu, drinks section, as sent by the venue
 * in September 2026. Coffee small/large, tea, iced drinks, cold-pressed juice,
 * signature drinks and milkshakes. Babyccino is left out: nobody at a weekday
 * morning meetup is ordering one ahead of time.
 */
export const VENUE_MENU: Menu = {
  venue: "The Avenue, Chatswood",
  categories: [
    { id: "coffee", zh: "咖啡", en: "Coffee" },
    { id: "tea", zh: "茶", en: "Tea" },
    { id: "iced", zh: "冰饮", en: "Iced" },
    { id: "juice", zh: "鲜榨果汁", en: "Cold-pressed juice" },
    { id: "signature", zh: "特调", en: "Signature" },
    { id: "milkshake", zh: "奶昔", en: "Milkshake" },
  ],
  items: [
    { id: "latte", name: "Latte", zh: "拿铁", category: "coffee", price: { small: 500, large: 550 } },
    { id: "flat-white", name: "Flat White", zh: "馥芮白", category: "coffee", price: { small: 500, large: 550 } },
    { id: "cappuccino", name: "Cappuccino", zh: "卡布奇诺", category: "coffee", price: { small: 500, large: 550 } },
    { id: "long-black", name: "Long Black", zh: "美式", category: "coffee", price: { small: 500, large: 550 } },
    { id: "mocha", name: "Mocha", zh: "摩卡", category: "coffee", price: { small: 500, large: 550 } },
    { id: "piccolo", name: "Piccolo", zh: "短笛拿铁", category: "coffee", price: { small: 500, large: 550 } },
    { id: "macchiato", name: "Macchiato", zh: "玛奇朵", category: "coffee", price: { small: 500, large: 550 } },
    { id: "chai-latte", name: "Chai Latte", zh: "印度奶茶", category: "coffee", price: { small: 500, large: 550 } },
    { id: "hot-chocolate", name: "Hot Chocolate", zh: "热巧克力", category: "coffee", price: { small: 500, large: 550 } },

    { id: "english-breakfast", name: "English Breakfast Tea", zh: "英式早餐茶", category: "tea", price: 500 },
    { id: "earl-grey", name: "Earl Grey Tea", zh: "伯爵茶", category: "tea", price: 500 },
    { id: "sencha", name: "Sencha Tea", zh: "煎茶（绿茶）", category: "tea", price: 500 },
    { id: "peppermint", name: "Peppermint Tea", zh: "薄荷茶", category: "tea", price: 500 },
    { id: "chamomile", name: "Chamomile Tea", zh: "洋甘菊茶", category: "tea", price: 500 },

    { id: "iced-latte", name: "Iced Latte", zh: "冰拿铁", category: "iced", price: 700 },
    { id: "iced-chai", name: "Iced Chai", zh: "冰印度奶茶", category: "iced", price: 700 },
    { id: "iced-chocolate", name: "Iced Chocolate", zh: "冰巧克力", category: "iced", price: 700 },
    { id: "iced-long-black", name: "Iced Long Black", zh: "冰美式", category: "iced", price: 700 },
    { id: "iced-coffee", name: "Iced Coffee", zh: "冰咖啡", category: "iced", price: 800 },

    { id: "juice-orange", name: "Orange Juice", zh: "橙汁", category: "juice", price: 950 },
    { id: "juice-tropical", name: "Tropical Juice", zh: "热带（橙、菠萝、苹果）", category: "juice", price: 950 },
    { id: "juice-detox", name: "Detox Juice", zh: "绿汁（菠菜、黄瓜、芹菜、苹果、柠檬、姜）", category: "juice", price: 950 },
    { id: "juice-citrus", name: "Citrus Juice", zh: "柑橘（苹果、薄荷、橙、青柠）", category: "juice", price: 950 },
    { id: "juice-morning-kick", name: "Morning Kick Juice", zh: "晨醒（橙、胡萝卜、姜、青柠）", category: "juice", price: 950 },

    { id: "avenue-sunrise", name: "Avenue Sunrise", zh: "西柚芒果 · 海盐芝士奶盖", category: "signature", price: 1200 },
    { id: "peach-ice-tea", name: "Peach Ice Tea", zh: "桃子冰茶", category: "signature", price: 900 },

    { id: "milkshake-chocolate", name: "Chocolate Milkshake", zh: "巧克力奶昔", category: "milkshake", price: 900 },
    { id: "milkshake-strawberry", name: "Strawberry Milkshake", zh: "草莓奶昔", category: "milkshake", price: 900 },
    { id: "milkshake-caramel", name: "Caramel Milkshake", zh: "焦糖奶昔", category: "milkshake", price: 900 },
    { id: "milkshake-vanilla", name: "Vanilla Milkshake", zh: "香草奶昔", category: "milkshake", price: 900 },
  ],
};

/** "$5.50" from 550. */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "$5.00 / $5.50" for a sized item, "$9.50" otherwise. */
export function priceRange(price: Price): string {
  return typeof price === "number" ? formatPrice(price) : `${formatPrice(price.small)} / ${formatPrice(price.large)}`;
}
