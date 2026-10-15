// Relative imports only: the tests load this through Node's type stripper.
import { randomBytes } from "node:crypto";

/**
 * The dinner after a Thursday (James 2026-10-15).
 *
 * The talking after a morning used to happen standing up, with whoever caught
 * the organiser first. Now it happens over a meal: a fixed number of seats,
 * one price for everyone, a few dishes to choose from, and a set running
 * order so every person gets the same time — a one-minute introduction, then
 * one question each. A seat is held by signing up and paying.
 *
 * Everything that depends on the restaurant comes from the DINNER_CONFIG
 * environment variable (JSON). Unset or invalid, the dinner is simply not
 * offered anywhere on the site. Bank details come from TUESDAY_PAYMENT_INFO,
 * the same account as Tuesday's fee.
 */
export type DinnerConfig = {
  /** Restaurant name and where it is, as shown to people. */
  place: string;
  /** When it starts, in words: "12:15，活动结束后步行 3 分钟". */
  time: string;
  /** What everyone transfers, GST included, in whole dollars. */
  price: number;
  /** Seats before the waitlist starts. */
  cap: number;
  /** The dishes to choose from. Ids are stored; never reuse one for a different dish. */
  dishes: { id: string; zh: string; en: string }[];
};

/** Reads DINNER_CONFIG, or null when the dinner is not on. Never throws. */
export function dinnerConfig(raw: string | undefined = process.env.DINNER_CONFIG): DinnerConfig | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<DinnerConfig>;
    const dishes = Array.isArray(c.dishes)
      ? c.dishes.filter((d) => d && typeof d.id === "string" && typeof d.zh === "string" && d.id.length <= 20)
      : [];
    if (typeof c.place !== "string" || typeof c.time !== "string" || typeof c.price !== "number" || c.price <= 0 || dishes.length === 0) return null;
    const cap = typeof c.cap === "number" && c.cap > 0 ? Math.floor(c.cap) : 12;
    return { place: c.place, time: c.time, price: c.price, cap, dishes: dishes.map((d) => ({ id: d.id, zh: d.zh, en: d.en || d.zh })) };
  } catch {
    return null;
  }
}

/** A payment reference: DN plus five characters, easy to read out and retype. */
export function newDinnerRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(5);
  return `DN${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

export function looksLikeDinnerRef(value: unknown): value is string {
  return typeof value === "string" && /^DN[A-HJ-NP-Z2-9]{5}$/.test(value);
}

/** The dinner as the signup form needs it: no bank details, nothing server-only. */
export type DinnerOffer = Pick<DinnerConfig, "place" | "time" | "price" | "cap" | "dishes">;
