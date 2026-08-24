"use client";

import { useCallback, useEffect, useState } from "react";
import type { CandidateId, CandidateNote } from "@/types/candidate";
import {
  addNote as addNoteRequest,
  deleteNote as deleteNoteRequest,
  getNotes,
} from "@/services/trackerApi";

const useNotes = (candidateId: CandidateId) => {
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setNotes(await getNotes(candidateId));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load internal notes.",
      );
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const addNote = async (content: string) => {
    setActionLoading(true);
    setError("");
    setFeedback("");

    try {
      const note = await addNoteRequest(candidateId, content);
      setNotes((current) => [note, ...current]);
      setFeedback("Internal note added.");
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add the note.",
      );
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const removeNote = async (noteId: CandidateId) => {
    setActionLoading(true);
    setError("");
    setFeedback("");

    try {
      await deleteNoteRequest(candidateId, noteId);
      setNotes((current) => current.filter((note) => note.id !== noteId));
      setFeedback("Internal note deleted.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete the note.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  return {
    notes,
    loading,
    actionLoading,
    error,
    feedback,
    addNote,
    removeNote,
    reload: loadNotes,
  };
};

export default useNotes;
