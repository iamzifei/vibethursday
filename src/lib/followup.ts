// Relative, not "@/": the tests load this through Node's type stripper.
import type { DeskEntry } from "./desk.ts";
import { isSpecialSession } from "./sessions.ts";

/**
 * The follow-up list after a session (2026-11-02): for each person who came,
 * what to do next. Plain rules over what they wrote and how often they come —
 * a list for the organiser to act on, not a score.
 */

export type FollowUpAction = "need" | "project" | "cert" | "membership" | "first";

export const ACTION_LABEL: Record<FollowUpAction, { title: string; todo: string }> = {
  need: { title: "带了需求", todo: "记进需求台账；找能接的共建者或导师团，散场后拉个小群。" },
  project: { title: "带了项目", todo: "问一句要不要找人一起做（成为共建者）；在作品进展里记一条。" },
  cert: { title: "备考 AWS 证书", todo: "拉进备考组，约下周二一起做模拟题。" },
  membership: { title: "常来周二、还不是会员", todo: "30 天内来了两次以上周二：介绍共创会员（一年周二免门票）。" },
  first: { title: "第一次来", todo: "散场后私信说声谢谢，问下次想聊什么。" },
};

/** The order the groups are shown and worked through in. */
export const ACTION_ORDER: FollowUpAction[] = ["need", "project", "membership", "cert", "first"];

const DAY = 24 * 60 * 60 * 1000;

export function followUps(desk: readonly DeskEntry[], session: string): { entry: DeskEntry; actions: FollowUpAction[] }[] {
  const end = Date.parse(`${session}T00:00:00Z`);
  return desk
    .filter((entry) => entry.arrived)
    .map((entry) => {
      const actions: FollowUpAction[] = [];
      if (entry.bring === "need") actions.push("need");
      if (entry.bring === "project" && !entry.builder) actions.push("project");
      if (entry.bring === "cert") actions.push("cert");
      const recentTuesdays = entry.sessions.filter((date) => {
        const at = Date.parse(`${date}T00:00:00Z`);
        return isSpecialSession(date) && at <= end && end - at <= 30 * DAY;
      }).length;
      if (!entry.member && !entry.mentor && recentTuesdays >= 2) actions.push("membership");
      if (entry.sessions.filter((date) => date < session).length === 0) actions.push("first");
      return { entry, actions };
    })
    .filter((item) => item.actions.length > 0);
}
