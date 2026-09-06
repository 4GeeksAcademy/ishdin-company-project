"use client";

import { useCallback, useEffect, useState } from "react";
import type { Candidate, CandidateId } from "@/types/candidate";
import { getCandidate } from "@/services/trackerApi";

const useCandidate = (id: CandidateId) => {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCandidate = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setCandidate(await getCandidate(id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load candidate details.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadCandidate();
  }, [loadCandidate]);

  return { candidate, setCandidate, loading, error, reload: loadCandidate };
};

export default useCandidate;
