# diffle Review

diffle gives a human a code-review-grade surface for evaluating work produced by an agent and returning actionable feedback to that agent.

## Language

**Review Session**:
A human review of one explicit Git comparison. Agent-task context may explain why the changes exist, but the diff is the subject and may contain work produced by agents, humans, or both.
_Avoid_: Agent session, agent audit

**Review Policy**:
The rule governing whether an agent enters a Review Hold after starting a Review Session (`required`), may hand it off and continue (`handoff`), or does not start one automatically (`off`). Manual review remains available in every mode.
_Avoid_: Gate configuration, blocking mode

**Review Hold**:
A pause in agent work while human review is pending. The agent yields control and resumes only after another user instruction; the user may override the hold without approving, cancelling, or otherwise changing the Review Session.
_Avoid_: Blocking request, waiting task

**Review Outcome**:
The reviewer's explicit conclusion: approve the work, return feedback to the agent, or cancel the Review Session without implying approval. An active Review Session is either awaiting human review or has feedback ready for the agent; a cancelled session is terminal, while an approved session returns to awaiting review when the agent requests a rereview. A reviewer may approve despite unresolved comments after acknowledging them.
_Avoid_: Finish status, completion state

**Feedback Bundle**:
The Review Summary and unresolved file-, line-, and range-level comments returned for more work; a bundle may consist of a summary alone. It is structured information that may also be rendered as JSON or Markdown for manual copy and paste.
_Avoid_: Compiled prompt, review prompt

**Review Summary**:
Optional review-level feedback that applies to the change as a whole rather than a particular file or line. It may accompany comments in a Feedback Bundle, or stand alone as the entire bundle, without inventing a code anchor.
_Avoid_: General comment, top-level comment

**Review Record**:
The durable representation of a Review Session and its activity, identified independently from any repository path so multiple tasks, worktrees, branches, and concurrent reviews cannot collide. A Review Record may be exported into a project, but the export is not its identity, and it is retained until explicitly deleted.
_Avoid_: `.review` file, review state

**Session Context**:
Optional provenance connecting a Review Session to an originating agent task: the original request, a summary, agent and task identifiers, repository and worktree, and base and head revisions. Human-authored reviews need no agent provenance; detailed transcripts and tool activity are referenced as optional evidence rather than copied by default.
_Avoid_: Transcript, agent log

**Review Comment**:
Human feedback anchored to a Review Session, file, line, or range. An agent may reply and mark it addressed; only the reviewer may resolve, reopen, or accept it as part of approving the Review Session.
_Avoid_: Note, annotation
