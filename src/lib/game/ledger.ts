import { awardPoints, weeklyBoard, type BoardRow } from "@/lib/db";
import { sydneyDate, weekStart } from "@/lib/game/points";
import { drainAwards, setCrown } from "@/lib/game/room";

/**
 * Between the in-memory room and the database: the room earns points as things
 * happen (`drainAwards`), this writes them down against the current week, and
 * serves the board back with a short cache — every open game asks for it.
 */

export function currentWeek(now: Date = new Date()): string {
  return weekStart(sydneyDate(now));
}

/** Writes whatever the room has earned. Never throws: a lost point is not worth a failed move. */
export async function flushAwards(): Promise<void> {
  const awards = drainAwards();
  if (awards.length === 0) return;
  const week = currentWeek();
  try {
    await awardPoints(awards.map((award) => ({ ...award, week })));
  } catch (error) {
    console.error("[play] could not write points", error);
  }
}

type Cached = { week: string; rows: BoardRow[]; at: number };
const cache = globalThis as unknown as { __vtPlayBoard?: Cached; __vtPlayCrown?: { week: string; at: number } };

/** This week's board, at most ten seconds old. */
export async function board(): Promise<{ week: string; rows: BoardRow[] }> {
  const week = currentWeek();
  const hit = cache.__vtPlayBoard;
  if (hit && hit.week === week && Date.now() - hit.at < 10_000) return hit;
  const rows = await weeklyBoard(week);
  cache.__vtPlayBoard = { week, rows, at: Date.now() };
  return { week, rows };
}

/** Last week's winner, looked up at most every ten minutes, and put on the room's crown. */
export async function refreshCrown(): Promise<BoardRow | null> {
  const week = currentWeek();
  const last = new Date(`${week}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 7);
  const lastWeek = last.toISOString().slice(0, 10);
  try {
    const rows = await weeklyBoard(lastWeek);
    const champion = rows[0] ?? null;
    const hit = cache.__vtPlayCrown;
    if (!hit || hit.week !== week || Date.now() - hit.at > 600_000) {
      setCrown(champion?.player ?? null);
      cache.__vtPlayCrown = { week, at: Date.now() };
    }
    return champion;
  } catch (error) {
    console.error("[play] could not read last week's board", error);
    return null;
  }
}

/** Forget the cached board, after something that should show at once (a claim). */
export function invalidateBoard(): void {
  cache.__vtPlayBoard = undefined;
}
