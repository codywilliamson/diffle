// owns the review comments array + its mutations, persisting each change (full-replace
// contract) then trusting local state. extracted from app.js to keep the orchestrator lean.
import { useState, useCallback } from "/preact.js";
import { saveComments, resolveReviewComment, replyToReviewComment } from "/api.js";

export function useComments(onError, reviewId = null, onSaved, localOnly = false) {
  const [comments, setComments] = useState([]);

  const persist = useCallback(
    (next) => {
      setComments(next);
      if (!localOnly) saveComments(next).then(onSaved).catch((e) => onError(String(e)));
    },
    [onError, onSaved, localOnly]
  );

  const onAdd = useCallback(
    (partial) => persist([...comments, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...partial }]),
    [comments, persist]
  );

  const onEdit = useCallback(
    (id, text, tag) => persist(comments.map((c) => (c.id === id ? { ...c, text, tag } : c))),
    [comments, persist]
  );

  const onDelete = useCallback((id) => persist(comments.filter((c) => c.id !== id)), [comments, persist]);

  // resolve keeps the comment but drops it from the prompt + open counts; toggles back on reopen.
  const onResolve = useCallback((id) => {
    const comment = comments.find((c) => c.id === id);
    if (!comment) return;
    const status = (comment.status ?? (comment.resolved ? "resolved" : "open")) === "resolved" ? "open" : "resolved";
    const next = comments.map((c) => (c.id === id ? { ...c, status, resolved: status === "resolved" } : c));
    setComments(next);
    if (localOnly) return;
    const save = reviewId ? resolveReviewComment(reviewId, id, status) : saveComments(next);
    save.then(onSaved).catch((e) => onError(String(e)));
  }, [comments, onError, reviewId, onSaved, localOnly]);

  // reviewer replies only exist against a durable Review Record — legacy `.review` mode has no thread.
  // no setComments here: onSaved refreshes the record, and the record -> comments sync applies it.
  // errors are left uncaught so the composer can await this promise and show them inline.
  const onReply = useCallback(
    (id, text) => replyToReviewComment(reviewId, id, text).then((record) => onSaved?.(record)),
    [reviewId, onSaved]
  );

  return { comments, setComments, onAdd, onEdit, onDelete, onResolve, onReply: reviewId && !localOnly ? onReply : null };
}
