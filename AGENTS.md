<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Half of this project lives outside this repo

This repo is only the **website**. How the meetup is actually run — what happens
on the day, what was learned from the last one, and every judgement about money
and the venue — is kept in a separate working directory that is not published.

Nothing in here hints that it exists, and that is the trap: a change proposed
from this repo alone can quietly undo a decision that was settled weeks ago
somewhere else, by someone who had a reason.

**So: anything touching money or the venue is out of scope for a change proposed
from this repo.** Ask first. Those calls are already made.

# This repository is public

Its history is public with it, and it cannot be taken back — forks, mirrors and
GitHub's event API all keep copies. A commit message here is a publication, not
a note to yourself.

One test covers the whole thing:

> **Would you put this sentence on the meetup's home page?**

If not, it does not belong in a commit message, a code comment, or a file in
this repo.

What most often fails that test is not a credential — scanners already catch
those — but the ordinary detail that seemed harmless while the repo was
private: what something cost, who was in the room, what somebody said in a
group chat. No lint rule, no test and no secret scanner will stop any of it.
Only the question above will.
