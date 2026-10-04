import assert from "node:assert/strict";
import { test } from "node:test";

import { tuesdaySplit } from "../src/lib/signup-stats.ts";

const TUE = "2026-10-06";
const THU = "2026-10-08";

test("counts who the Tuesday took off that week's Thursday", () => {
  const split = tuesdaySplit(
    [
      // moved from Thursday to Tuesday on /my: Tuesday only, a regular, a builder
      { sessions: ["2026-09-24", TUE], waitlist: [], purposes: `2026-09-24=learn ${TUE}=tech` },
      // both mornings
      { sessions: [TUE, THU], waitlist: [], purposes: `${TUE}=product ${THU}=product` },
      // Tuesday waitlist, new, not a builder
      { sessions: [], waitlist: [TUE], purposes: `${TUE}=learn` },
      // Thursday only
      { sessions: [THU], waitlist: [], purposes: `${THU}=biz` },
      { sessions: [THU], waitlist: [], purposes: "" },
    ],
    TUE,
  );
  assert.equal(split.thursday, THU);
  assert.equal(split.tuesdayBooked, 2);
  assert.equal(split.tuesdayWaitlist, 1);
  assert.equal(split.thursdayBooked, 3);
  assert.equal(split.tuesdayOnly, 2);
  assert.equal(split.both, 1);
  assert.equal(split.regulars, 1);
  assert.equal(split.builders, 2);
});

test("a purpose answered for another date does not count as the Tuesday's", () => {
  const split = tuesdaySplit([{ sessions: [TUE], waitlist: [], purposes: `2026-09-24=tech ${TUE}=learn` }], TUE);
  assert.equal(split.builders, 0);
});

test("business focus: only known answers, deduplicated, in the form's order", async () => {
  const { parseBizFocus } = await import("../src/lib/signup-profile.ts");
  assert.deepEqual(parseBizFocus(["service", "leads", "leads", "hack", 3, " ops "]), ["leads", "service", "ops"]);
  assert.deepEqual(parseBizFocus("leads"), []);
  assert.deepEqual(parseBizFocus(undefined), []);
});

test("the composition table counts business focus per mention, per session", async () => {
  const { compositionPerSession } = await import("../src/lib/signup-stats.ts");
  const [row] = compositionPerSession(
    [
      { sessions: [THU], ai_level: null, industry: "food", purposes: `${THU}=biz`, biz_focus: ["leads", "service"] },
      { sessions: [THU], ai_level: null, industry: "property", purposes: `${THU}=biz`, biz_focus: ["leads"] },
      { sessions: [THU], ai_level: "daily", industry: null, purposes: `${THU}=product` },
    ],
    [THU],
  );
  assert.deepEqual(row.bizFocus, { leads: 2, service: 1 });
});

test("every registered Build Tuesday really is a Tuesday", async () => {
  const { SPECIAL_SESSIONS } = await import("../src/lib/sessions.ts");
  for (const session of SPECIAL_SESSIONS) {
    assert.equal(new Date(`${session.date}T00:00:00Z`).getUTCDay(), 2, session.date);
  }
});
