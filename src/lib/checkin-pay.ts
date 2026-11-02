/**
 * Where a check-in leads on a paid Build Tuesday (2026-11-02). Pure, so the
 * rule is tested without a database; /api/checkin follows it.
 *
 * - Not a fee day, free for this person (共创会员 / 导师团), or already
 *   settled: on to their badge, as before.
 * - Booked and still owing: their own payment page, marked "checked in".
 * - Not booked (a walk-in who found the room full): checked in on the
 *   waitlist; the organiser decides. A place is never promised at the door.
 */
export type AfterCheckin = "badge" | "pay" | "full";

export function afterCheckin(input: {
  feeDay: boolean;
  free: boolean;
  booked: boolean;
  status: "pending" | "paid" | "waived" | null;
}): AfterCheckin {
  if (!input.feeDay || input.free) return "badge";
  if (!input.booked) return "full";
  return input.status === "paid" || input.status === "waived" ? "badge" : "pay";
}
