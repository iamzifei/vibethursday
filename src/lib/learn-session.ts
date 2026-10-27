import { cookies } from "next/headers";
import { findLearner, learnerForOpenid, touchLearner, type Learner } from "./learn-db.ts";
import { LEARN_COOKIE, readLearnerToken } from "./learn.ts";
import { readOpenidToken } from "./wechat-auth.ts";
import { WX_OPENID_COOKIE } from "./wechat-gate.ts";

/**
 * Who is looking at /learn, or null.
 *
 * Two ways in, checked in this order:
 * 1. The learner cookie, set after an email code (or by /api/learn/session).
 * 2. The WeChat openid the service account's login already left in a signed
 *    cookie. The first time, this creates a `pending` learner for it — which
 *    is what puts them in front of the organiser to approve.
 *
 * Only reads cookies, never writes them: server components cannot.
 */
export async function currentLearner(): Promise<Learner | null> {
  try {
    const store = await cookies();
    const id = readLearnerToken(store.get(LEARN_COOKIE)?.value);
    if (id) {
      const learner = await findLearner(id);
      if (learner) {
        await touchLearner(learner.id);
        return learner;
      }
    }
    const openid = readOpenidToken(store.get(WX_OPENID_COOKIE)?.value);
    if (openid) return await learnerForOpenid(openid);
  } catch (error) {
    console.error("[learn] could not resolve the learner", error);
  }
  return null;
}
