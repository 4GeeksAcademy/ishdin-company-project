"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import useCandidate from "@/hooks/useCandidate";
import useCandidates from "@/hooks/useCandidates";
import useNotes from "@/hooks/useNotes";
import { patchCandidate, updateCandidate } from "@/services/trackerApi";
import { uniqueValues } from "@/lib/format";
import type { Candidate, CandidateFormValues } from "@/types/candidate";
import CandidateDetailsCard from "./CandidateDetailsCard";
import CandidateForm from "./CandidateForm";
import ErrorState from "./ErrorState";
import FeedbackBanner from "./FeedbackBanner";
import LoadingState from "./LoadingState";
import Modal from "./Modal";
import NotesPanel from "./NotesPanel";
import PipelineControls from "./PipelineControls";

const toFormValues = (candidate: Candidate): CandidateFormValues => ({
  name: candidate.name,
  email: candidate.email,
  phone: candidate.phone,
  position: candidate.position,
  linkedinUrl: candidate.linkedinUrl,
  cvUrl: candidate.cvUrl,
  yearsOfExperience: candidate.yearsOfExperience?.toString() ?? "",
  status: candidate.status,
  stage: candidate.stage,
  applicationDate: candidate.applicationDate.slice(0, 10),
});

const CandidateDetailView = () => {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/";

  const { candidate, setCandidate, loading, error, reload } = useCandidate(id);
  const pipeline = useCandidates();
  const notes = useNotes(id);

  const [busyField, setBusyField] = useState<"status" | "stage" | "">("");
  const [feedback, setFeedback] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const statusOptions = useMemo(
    () => uniqueValues([
      "selected",
      candidate?.status ?? "",
      ...pipeline.candidates.map((item) => item.status),
    ]),
    [candidate, pipeline.candidates],
  );

  const stageOptions = useMemo(
    () => uniqueValues([
      candidate?.stage ?? "",
      ...pipeline.candidates.map((item) => item.stage),
    ]),
    [candidate, pipeline.candidates],
  );

  const updatePipeline = async (field: "status" | "stage", value: string) => {
    if (!candidate || value === candidate[field]) return;
    setBusyField(field);
    setFeedback("");
    setMutationError("");

    try {
      const updated = await patchCandidate(candidate.id, { [field]: value });
      setCandidate(updated);
      setFeedback(`${field === "status" ? "Status" : "Stage"} updated successfully.`);
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : `Unable to update ${field}.`,
      );
    } finally {
      setBusyField("");
    }
  };

  const saveEdit = async (values: CandidateFormValues) => {
    if (!candidate) return;
    setEditing(true);
    setFeedback("");
    setMutationError("");

    try {
      const updated = await updateCandidate(candidate.id, values);
      setCandidate(updated);
      setEditOpen(false);
      setFeedback("Candidate information updated.");
    } catch (requestError) {
      setMutationError(
        requestError instanceof Error ? requestError.message : "Unable to update candidate.",
      );
    } finally {
      setEditing(false);
    }
  };

  if (loading) return <main className="shell page"><LoadingState label="Loading candidate profile..." /></main>;
  if (error || !candidate) return <main className="shell page"><ErrorState message={error || "Candidate not found."} onRetry={() => void reload()} /></main>;

  return (
    <main className="shell page">
      <div className="detail-toolbar">
        <Link className="text-link" href={returnTo}>← Back to candidate pipeline</Link>
        <button className="button secondary" type="button" onClick={() => setEditOpen(true)}>
          Edit candidate
        </button>
      </div>

      <FeedbackBanner message={feedback} />
      <FeedbackBanner message={mutationError} tone="error" />

      <CandidateDetailsCard candidate={candidate} />

      {pipeline.loading && <div className="inline-state">Loading pipeline values...</div>}
      {pipeline.error && <FeedbackBanner message={`Pipeline options: ${pipeline.error}`} tone="error" />}

      <PipelineControls
        candidate={candidate}
        statusOptions={statusOptions}
        stageOptions={stageOptions}
        disabled={pipeline.loading || Boolean(pipeline.error)}
        busyField={busyField}
        onChange={(field, value) => void updatePipeline(field, value)}
      />

      <NotesPanel
        notes={notes.notes}
        loading={notes.loading}
        actionLoading={notes.actionLoading}
        error={notes.error}
        feedback={notes.feedback}
        onAdd={notes.addNote}
        onDelete={notes.removeNote}
      />

      <Modal title="Edit candidate information" open={editOpen} onClose={() => setEditOpen(false)}>
        <FeedbackBanner message={mutationError} tone="error" />
        <CandidateForm
          initialValues={toFormValues(candidate)}
          submitLabel="Save changes"
          submitting={editing}
          onSubmit={saveEdit}
        />
      </Modal>
    </main>
  );
};

export default CandidateDetailView;
