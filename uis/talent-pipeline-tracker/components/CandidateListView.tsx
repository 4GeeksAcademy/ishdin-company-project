"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useCandidates from "@/hooks/useCandidates";
import { createCandidate } from "@/services/trackerApi";
import { uniqueValues } from "@/lib/format";
import type { CandidateFormValues } from "@/types/candidate";
import CandidateFilters from "./CandidateFilters";
import CandidateForm from "./CandidateForm";
import CandidateTable from "./CandidateTable";
import ErrorState from "./ErrorState";
import FeedbackBanner from "./FeedbackBanner";
import LoadingState from "./LoadingState";
import Modal from "./Modal";

const CandidateListView = () => {
  const { candidates, loading, error, reload } = useCandidates();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [stage, setStage] = useState(params.get("stage") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSearch(params.get("q") ?? "");
    setStatus(params.get("status") ?? "");
    setStage(params.get("stage") ?? "");
  }, [params]);

  const updateQuery = (nextSearch: string, nextStatus: string, nextStage: string) => {
    const next = new URLSearchParams(params.toString());
    nextSearch ? next.set("q", nextSearch) : next.delete("q");
    nextStatus ? next.set("status", nextStatus) : next.delete("status");
    nextStage ? next.set("stage", nextStage) : next.delete("stage");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    updateQuery(value, status, stage);
  };

  const changeStatus = (value: string) => {
    setStatus(value);
    updateQuery(search, value, stage);
  };

  const changeStage = (value: string) => {
    setStage(value);
    updateQuery(search, status, value);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const matchesSearch =
        !term ||
        candidate.name.toLowerCase().includes(term) ||
        candidate.email.toLowerCase().includes(term);
      return (
        matchesSearch &&
        (!status || candidate.status === status) &&
        (!stage || candidate.stage === stage)
      );
    });
  }, [candidates, search, status, stage]);

  const handleCreate = async (values: CandidateFormValues) => {
    setSubmitting(true);
    setFeedback("");
    setFormError("");

    try {
      await createCandidate(values);
      await reload();
      setCreateOpen(false);
      setFeedback("Candidate registered in the People & Talent pipeline.");
    } catch (requestError) {
      setFormError(
        requestError instanceof Error ? requestError.message : "Unable to register candidate.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentRoute = `${pathname}${params.toString() ? `?${params}` : ""}`;
  const statuses = uniqueValues(["selected", ...candidates.map((candidate) => candidate.status)]);
  const stages = uniqueValues(candidates.map((candidate) => candidate.stage));

  return (
    <main className="shell page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">People &amp; Talent</p>
          <h1>Candidate pipeline</h1>
          <p>Review the active recruitment campaign without spreadsheets or email threads.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setCreateOpen(true)}>
          + Register candidate
        </button>
      </div>

      <FeedbackBanner message={feedback} />

      {loading ? (
        <LoadingState label="Loading candidate pipeline..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <>
          <CandidateFilters
            search={search}
            status={status}
            stage={stage}
            statusOptions={statuses}
            stageOptions={stages}
            onSearchChange={changeSearch}
            onStatusChange={changeStatus}
            onStageChange={changeStage}
          />
          <div className="results-meta">
            <strong>{filtered.length}</strong> of {candidates.length} candidates shown
          </div>
          <CandidateTable candidates={filtered} returnTo={currentRoute} />
        </>
      )}

      <Modal title="Register a new candidate" open={createOpen} onClose={() => setCreateOpen(false)}>
        <FeedbackBanner message={formError} tone="error" />
        <CandidateForm submitLabel="Register candidate" submitting={submitting} onSubmit={handleCreate} />
      </Modal>
    </main>
  );
};

export default CandidateListView;
