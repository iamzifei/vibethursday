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
