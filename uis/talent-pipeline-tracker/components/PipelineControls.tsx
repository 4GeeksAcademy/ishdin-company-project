import type { Candidate } from "@/types/candidate";
import { formatLabel } from "@/lib/format";

interface PipelineControlsProps {
  candidate: Candidate;
  statusOptions: string[];
  stageOptions: string[];
  disabled?: boolean;
  busyField: "status" | "stage" | "";
  onChange: (field: "status" | "stage", value: string) => void;
}

const PipelineControls = ({
  candidate,
  statusOptions,
  stageOptions,
  disabled = false,
  busyField,
  onChange,
}: PipelineControlsProps) => {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Pipeline controls</h2>
          <p>Move this candidate through the recruitment process in one interaction.</p>
        </div>
      </div>

      <div className="form-grid two">
        <label className="field">
          <span>Candidate status</span>
          <select
            value={candidate.status}
            disabled={disabled || Boolean(busyField)}
            onChange={(event) => onChange("status", event.target.value)}
          >
            {statusOptions.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
          {busyField === "status" && <small>Updating status...</small>}
        </label>

        <label className="field">
          <span>Application stage</span>
          <select
            value={candidate.stage}
            disabled={disabled || Boolean(busyField)}
            onChange={(event) => onChange("stage", event.target.value)}
          >
            {stageOptions.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
          {busyField === "stage" && <small>Updating stage...</small>}
        </label>
      </div>
    </section>
  );
};

export default PipelineControls;
