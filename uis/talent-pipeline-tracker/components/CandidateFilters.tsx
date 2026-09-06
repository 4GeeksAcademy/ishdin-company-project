import { formatStageLabel } from "@/lib/format";

interface CandidateFiltersProps {
  search: string;
  status: string;
  stage: string;
  statusOptions: string[];
  stageOptions: string[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStageChange: (value: string) => void;
}

const CandidateFilters = ({
  search,
  status,
  stage,
  statusOptions,
  stageOptions,
  onSearchChange,
  onStatusChange,
  onStageChange,
}: CandidateFiltersProps) => {
  return (
    <section className="filter-bar" aria-label="Candidate filters">
      <label className="field grow">
        <span>Search candidates</span>
        <input
          type="search"
          value={search}
          placeholder="Search by name or email"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Status</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Stage</span>
        <select value={stage} onChange={(event) => onStageChange(event.target.value)}>
          <option value="">All stages</option>
          {stageOptions.map((option) => (
            <option key={option} value={option}>{formatStageLabel(option)}</option>
          ))}
        </select>
      </label>
    </section>
  );
};

export default CandidateFilters;
