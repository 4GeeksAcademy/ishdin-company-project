"use client";

import { FormEvent, useState } from "react";
import type { CandidateId, CandidateNote } from "@/types/candidate";
import { formatDate } from "@/lib/format";
import FeedbackBanner from "./FeedbackBanner";
import LoadingState from "./LoadingState";

interface NotesPanelProps {
  notes: CandidateNote[];
  loading: boolean;
  actionLoading: boolean;
  error: string;
  feedback: string;
  onAdd: (content: string) => Promise<boolean>;
  onDelete: (id: CandidateId) => Promise<void>;
}

const NotesPanel = ({
  notes,
  loading,
  actionLoading,
  error,
  feedback,
  onAdd,
  onDelete,
}: NotesPanelProps) => {
  const [content, setContent] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;

    if (await onAdd(content)) {
      setContent("");
    }
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Internal notes</h2>
          <p>Interview context and People &amp; Talent follow-ups stay with the candidate.</p>
        </div>
      </div>

      <FeedbackBanner message={feedback} />
      <FeedbackBanner message={error} tone="error" />

      <form className="note-form" onSubmit={submit}>
        <label className="field grow">
          <span>Add internal note</span>
          <textarea
            value={content}
            rows={3}
            placeholder="Add interview feedback or a recruiting follow-up..."
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <button className="button primary" disabled={actionLoading || !content.trim()}>
          {actionLoading ? "Saving..." : "Add note"}
        </button>
      </form>

      {loading ? (
        <LoadingState label="Loading internal notes..." />
      ) : notes.length === 0 ? (
        <div className="empty-state compact">No internal notes yet.</div>
      ) : (
        <div className="notes-list">
          {notes.map((note) => (
            <article className="note" key={note.id}>
              <div>
                <strong>{note.author}</strong>
                <small>{formatDate(note.createdAt)}</small>
                <p>{note.content}</p>
              </div>
              <button
                className="button danger ghost"
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  if (window.confirm("Delete this internal note?")) {
                    void onDelete(note.id);
                  }
                }}
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default NotesPanel;
