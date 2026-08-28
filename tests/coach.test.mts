import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildSystem, EXAMPLES, GAPS, readCoaching } from "../src/lib/coach-prompt.ts";
import { copy } from "../src/lib/content.ts";

/**
 * The ask-box helper's contract with the model.
 *
 * The request itself is not tested here on purpose: it needs a key and a
 * network, and everything that can go wrong in it has one outcome anyway —
 * null, and the button did nothing. What is worth pinning down is the parsing,
 * because that is where a broken answer could become a confident-looking one,
 * and the shape of the prompt, because the prompt is now an artefact rather
 * than a string.
 *
 * How good the answers actually are is a different question and a different
 * instrument: `npm run coach:eval`, which grades against real drafts.
 */

test("a named gap and a question come through", () => {
  assert.deepEqual(readCoaching('{"gap":"object","ask":"你在跑的是什么工作流"}'), {
    gap: "object",
    ask: "你在跑的是什么工作流",
  });
});

test("the two leave-it-alone verdicts carry no question", () => {
  assert.deepEqual(readCoaching('{"gap":"none","ask":""}'), { gap: "none", ask: "" });
  assert.deepEqual(readCoaching('{"gap":"social","ask":""}'), { gap: "social", ask: "" });
});

test("a question attached to a leave-it-alone verdict is dropped, not shown", () => {
  // Contradictory output. Showing the question would contradict the verdict the
  // same response just gave, so the verdict wins.
  assert.deepEqual(readCoaching('{"gap":"none","ask":"你在做什么"}'), { gap: "none", ask: "" });
});

test("★ an unknown gap is refused rather than coerced into a plausible one", () => {
  // Falling back to a default here would file advice under a category the model
  // did not choose, and the eval score would then be measuring the fallback.
  assert.equal(readCoaching('{"gap":"vibes","ask":"你在做什么"}'), null);
  assert.equal(readCoaching('{"ask":"你在做什么"}'), null);
});

test("a gap with no question is nothing to show", () => {
  assert.equal(readCoaching('{"gap":"object","ask":""}'), null);
  assert.equal(readCoaching('{"gap":"object","ask":"   "}'), null);
});

test("a fenced or chatty answer is still read", () => {
  // JSON mode is requested, but a model that ignores it wraps rather than gives
  // up. Recovering costs one regex.
  assert.deepEqual(readCoaching('```json\n{"gap":"object","ask":"你在做什么"}\n```'), {
    gap: "object",
    ask: "你在做什么",
  });
});

test("junk is null, not a crash and not a guess", () => {
  assert.equal(readCoaching(""), null);
  assert.equal(readCoaching("抱歉，我不能帮你"), null);
  assert.equal(readCoaching("[1,2,3]"), null);
});

test("a model ignoring the length rule is cut", () => {
  const long = readCoaching(JSON.stringify({ gap: "object", ask: "啊".repeat(300) }));
  assert.ok(long && long.ask.length <= 80);
});

test("★ no example carries its label inside the text a person would read", () => {
  // The first version wrote the gap as a parenthetical after the question, and
  // the model copied the parenthetical into live answers — users saw
  // "你在推的是什么东西（缺对象）". The label belongs in its own field.
  for (const example of EXAMPLES) {
    for (const gap of GAPS) {
      assert.ok(!example.ask.includes(gap), `${example.draft}: leaks "${gap}" into the question`);
    }
    assert.ok(!/[（(]缺/.test(example.ask), `${example.draft}: leaks an annotation`);
  }
});

test("★ the examples cover every verdict the parser accepts", () => {
  // A label with no example is a label the model has only been told about. The
  // one that mattered was `social`: described in prose and, for one release,
  // shown nowhere.
  const shown = new Set(EXAMPLES.map((e) => e.gap));
  for (const gap of GAPS) {
    assert.ok(shown.has(gap), `no example shows "${gap}"`);
  }
});

test("★ leave-it-alone examples are silent, gap examples are not", () => {
  for (const example of EXAMPLES) {
    const quiet = example.gap === "none" || example.gap === "social";
    assert.equal(example.ask === "", quiet, `${example.draft}: ask and gap disagree`);
  }
});

test("the prompt asks for json, which DeepSeek's json mode requires", () => {
  assert.match(buildSystem(), /json/);
});

test("every example reaches the prompt", () => {
  const system = buildSystem();
  for (const example of EXAMPLES) {
    assert.ok(system.includes(example.draft), `${example.draft} is not in the prompt`);
  }
});

test("★ the graded drafts and the examples share nothing", () => {
  // Grading a model on the sentences it was shown measures copying. The eval
  // score is only worth reading while these two sets stay disjoint, and it is
  // very easy to fix a miss by quietly promoting the failing draft into the
  // few-shot — which scores 100% and teaches nothing.
  const fixture = JSON.parse(
    readFileSync(path.join(process.cwd(), "tests/fixtures/coach-drafts.json"), "utf8"),
  ) as { drafts: { draft: string }[] };

  // ⚠️ Normalised, because the first near-collision differed only in whether
  // its commas were full-width. An exact-match check passes that and the score
  // silently counts a memorised answer.
  const key = (draft: string) =>
    draft
      .replace(/[，,、。.！!？?：:；;\s]/g, "")
      .toLowerCase();

  const shown = new Set(EXAMPLES.map((e) => key(e.draft)));

  for (const row of fixture.drafts) {
    assert.ok(
      !shown.has(key(row.draft)),
      `"${row.draft}" is both an example and a graded draft (punctuation aside)`,
    );
  }

  assert.ok(fixture.drafts.length >= 15, "too few graded drafts for the score to mean much");
});

test("★ the vague lane is a third thing, not a synonym for the chat lane", () => {
  // These two say different things about a person. "想聊的" says they came to
  // meet people; "还没问清楚" says they want an answer and did not say enough
  // to get one. Sharing copy would tell a whole group of people they wanted
  // something they did not.
  assert.notEqual(copy.zh.wharf.laneVague, copy.zh.wharf.laneChat);
  assert.notEqual(copy.zh.wharf.laneVagueNote, copy.zh.wharf.laneChatNote);
  assert.notEqual(copy.en.wharf.laneVague, copy.en.wharf.laneChat);
});

test("★ a triage pass never touches a question somebody has acted on", () => {
  // A claim or an answer is stronger evidence that a question was answerable
  // than any opinion about its wording. Demoting one would tell the person who
  // answered that the thing they answered was not a real question.
  const sql = readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8");
  const query = sql.slice(sql.indexOf("listTriageCandidates"));

  assert.match(query, /NOT EXISTS[\s\S]{0,120}wharf_replies/, "must skip claimed or answered rows");
  assert.match(query, /closed_at IS NULL/, "must skip closed rows");
  assert.match(query, /lane = 'question'/, "must only look at rows nobody has moved yet");
});

test("★ the triage script does not write unless told to", () => {
  // It demotes people's sentences based on a model that is right about four
  // times in five. Fine as a suggestion, not fine as something that happens
  // quietly while nobody is looking.
  const script = readFileSync(path.join(process.cwd(), "scripts/coach-triage.mjs"), "utf8");

  assert.match(script, /--apply/);
  assert.ok(
    script.indexOf("if (!APPLY)") < script.indexOf("setQuestionLane(move.id"),
    "the dry-run exit must come before any write",
  );
});

test("★ the admin triage button is behind the key, and above the per-row guard", () => {
  const route = readFileSync(path.join(process.cwd(), "src/app/api/admin/wharf/route.ts"), "utf8");

  const auth = route.indexOf("isAdmin(key)");
  const triage = route.indexOf('action === "triage"');
  const idGuard = route.indexOf('error: "bad_id"');

  assert.ok(auth > 0 && triage > 0 && idGuard > 0);
  // It spends money and rewrites lanes in bulk. The key comes first, always.
  assert.ok(auth < triage, "triage must sit behind the admin key");
  // And it acts on the whole board, so it carries no id — putting it below the
  // per-row guard rejected it with "bad_id", which is what happened first time.
  assert.ok(triage < idGuard, "triage carries no id and must answer before that guard");
});
