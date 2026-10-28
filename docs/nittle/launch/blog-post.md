# Why line-level review beats asking the agent to review itself

Draft for Cody. Nothing here has been published. Quotes come from the Show HN thread for moritzwilksch/diffle (https://news.ycombinator.com/item?id=50006930), read on 2026-10-20. The rest is argument, and no numbers in it are measured. If you want numbers, run the experiment in the second-to-last section and add them.

---

Earlier this month a Show HN went up for a keyboard-driven diff viewer called diffle. It isn't mine. I have a different project that, until recently, had the same name. The thread under it is the clearest short argument I've read about how people review agent code today, so I'll quote it.

A commenter, igor47, put the common position in two sentences. "I feel like I would have loved this a year ago when I still reviewed PRs by reading diffs. Alas these days I do my reviews inside a harness using my code review skill." And then: "I don't see how I could keep up with the volume of code my team now produces without this. How do other people do it?" (comment 50039895)

The volume problem is real. Agents write more code than you can read at the old pace. So you hand the reading to another agent run, or the same one, and ask it to review. Two replies in the thread push back from opposite sides. zelphirkalt: "By having policies in place of at least doing reviews by reading and understanding what is going on." And kqr suggests a middle path: "picking a random sample of commits to review more thoroughly by hand in parallel with the harness review." The point of the sample, kqr says, is to "measure how many and what kind of issues your harness method misses." (comment 50040887)

I think kqr has the shape of it. The self-review half is weaker than it feels.

## The reviewer shares the author's blind spots

When an agent writes a change and then reviews it, the reviewer often starts from the same context the author had. It read the same files, formed the same idea of what the task was, and made the same assumptions about what the code around it does. If the author misread the requirement, the reviewer may have the same misreading to compare against. It can look at the diff and find it consistent with the task as understood, because it is.

A fresh run with a different prompt helps some. It can still miss what the author missed, especially the stuff that isn't in the repo. Why the retry limit is three. Which endpoint a customer quietly depends on. That the thing named "temp" will be there for five years. You may know those. The agent usually doesn't, and a second pass has no way to invent them.

## A vague review gets a vague fix

Say you ask an agent to review its change, and it returns six findings. Four are style. One is real. One is a hallucinated problem it then "fixes" by making the code worse. You read all six to find the one that mattered.

Compare the other direction. You open the diff and click line 48 of `fetch.ts`. You write: "No timeout. This hangs forever when the dev server is down." The comment carries the file, the line and the code around it. The agent has far less to guess about what you meant. It can change line 48 and reply in the thread. You look at line 48 again.

The difference is precision. A comment anchored to one line is cheap to write and leaves little room for misreading. A request to "review for problems" is cheap to write too, and the result is whatever the model decides to look at.

## What the human review is for

The review that matters is checking intent. Does this change do what I meant, in the place I meant, without touching what I didn't mean? Code can pass every test and still be the wrong change. An agent is bad at telling you that, because it has no stake in your intent beyond the prompt you gave it.

This is the argument for keeping a human in the loop, but it only holds if the human review is cheap. If reading the diff is slow, people stop. The tool has to make a careful read quick enough to keep doing. Four things get it there. Show the diff the way you'd read it. Let you move by keyboard so your hands don't leave the code. Flag the places most likely to hurt (removed public API, missing tests, changed dependencies) so your attention goes there first. And make the comment the unit of work, so that what you notice becomes an instruction without any retyping.

## The sampling idea, with the loop closed

I take kqr's suggestion seriously, and I'd make it concrete. Keep the agent review, because it's cheap and it does catch things. Then review a sample by hand, line by line, and write down what the agent review missed. After a few weeks you'll have an estimate of what the agent review misses in your codebase. It is only an estimate. Your hand review also misses things, so you can't treat your findings as the full set of real defects. kqr's framing is that you can then decide whether the speedup pays for the missed issues. You make that call with some data, not by assumption.

If your hand reviews are comments on lines, the data is a byproduct. Each comment is a record: file, line, what was wrong. Count the ones the agent review also flagged. Divide the unmatched ones by all the findings from your hand reviews in the sample. That is the share of human-found issues the agent review missed in that sample. It has a known denominator, but it is a sample estimate, not an overall miss rate, and it says nothing about defects neither of you found.

## What this looks like with nittle

I built nittle to make the hand review fast enough to keep doing. The loop is short:

    nittle                 # opens the working-tree diff in your browser
    nittle setup           # once, to wire it into your agents

You comment on lines, ranges or files. You press Return Feedback. The agent gets the comments over a local MCP server (or as a prompt on stdout if you run `nittle --wait`). It replies in each thread, marks them addressed, and asks for another pass. The scorecard flags removed public API, missing tests and dependency changes from fixed rules, with no model involved, so you know where to read first.

Comments are plain JSON under `~/.nittle/reviews`, so the tally in the previous section is a short script, once you decide how to match a human comment to an agent finding.

It isn't a replacement for tests, or for an automated reviewer. Run both. The claim is smaller: the person who knows what the change is for should read it, and should be able to point at the exact line when something is wrong. An agent asked to review itself is poorly placed to do that part, however good it is at the rest.

## The part I'd test

If you want to find out whether this is true for your setup, the experiment is cheap. For two weeks, let your normal harness review every change. On a random one in five, also review by hand and comment on the lines. Tally what you found that the harness didn't, and divide by everything you found in those reviews. If the answer is close to zero, keep the harness and skip the hand review. I'd be surprised, but I could be wrong, which is why you measure.

Install: `curl -fsSL https://nittle.dev/install | sh` on macOS and Linux, `pwsh -c "irm https://nittle.dev/install.ps1 | iex"` on Windows (PowerShell 7 is required). Docs at https://nittle.dev.
