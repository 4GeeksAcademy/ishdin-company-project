import { Suspense } from "react";
import CandidateDetailView from "@/components/CandidateDetailView";
import LoadingState from "@/components/LoadingState";

const CandidateDetailPage = () => {
  return (
    <Suspense
      fallback={
        <main className="shell page">
          <LoadingState label="Preparing candidate details..." />
        </main>
      }
    >
      <CandidateDetailView />
    </Suspense>
  );
};

export default CandidateDetailPage;
