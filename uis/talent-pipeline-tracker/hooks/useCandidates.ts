"use client";

import { useCallback, useEffect, useState } from "react";
import type { Candidate } from "@/types/candidate";
import { getCandidates } from "@/services/trackerApi";

const useCandidates = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setCandidates(await getCandidates());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load candidates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  return { candidates, loading, error, reload: loadCandidates };
};

export default useCandidates;
