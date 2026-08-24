import Link from "next/link";
import type { Candidate } from "@/types/candidate";
import StatusBadge from "./StatusBadge";

interface CandidateTableProps {
  candidates: Candidate[];
  returnTo: string;
}

const CandidateTable = ({ candidates, returnTo }: CandidateTableProps) => {
  if (candidates.length === 0) {
    return (
      <div className="empty-state">
        <strong>No candidates found</strong>
        <p>Try changing the search term or pipeline filters.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="candidate-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Position</th>
            <th>Status</th>
            <th>Stage</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>
                <strong>{candidate.name || "Unnamed candidate"}</strong>
                <small>{candidate.email}</small>
              </td>
              <td>{candidate.position || "Not provided"}</td>
              <td><StatusBadge value={candidate.status} /></td>
              <td><StatusBadge value={candidate.stage} kind="stage" /></td>
              <td>
                <Link
                  className="text-link"
                  href={`/candidates/${candidate.id}?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  View detail →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CandidateTable;
