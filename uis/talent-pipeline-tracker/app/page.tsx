import { Suspense } from "react";
import CandidateListView from "@/components/CandidateListView";
import LoadingState from "@/components/LoadingState";

const CandidateListPage = () => {
  return (
    <Suspense
      fallback={
        <main className="shell page">
          <LoadingState label="Preparing the People & Talent pipeline..." />
        </main>
      }
    >
      <CandidateListView />
    </Suspense>
  );
};

export default CandidateListPage;
