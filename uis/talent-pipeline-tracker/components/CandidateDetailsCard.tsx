import type { Candidate } from "@/types/candidate";
import { formatDate } from "@/lib/format";
import StatusBadge from "./StatusBadge";

interface CandidateDetailsCardProps {
  candidate: Candidate;
}

const DetailItem = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="detail-item">
    <dt>{label}</dt>
    <dd>{children || "Not provided"}</dd>
  </div>
);

const CandidateDetailsCard = ({ candidate }: CandidateDetailsCardProps) => {
  return (
    <section className="panel">
      <div className="candidate-hero">
        <div className="avatar">{candidate.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Candidate profile</p>
          <h1>{candidate.name}</h1>
          <p>{candidate.position}</p>
          <div className="badge-row">
            <StatusBadge value={candidate.status} />
            <StatusBadge value={candidate.stage} kind="stage" />
          </div>
        </div>
      </div>

      <dl className="detail-grid">
        <DetailItem label="Email">{candidate.email}</DetailItem>
        <DetailItem label="Phone">{candidate.phone}</DetailItem>
        <DetailItem label="Position applied for">{candidate.position}</DetailItem>
        <DetailItem label="Years of experience">
          {candidate.yearsOfExperience === null ? "Not provided" : candidate.yearsOfExperience}
        </DetailItem>
        <DetailItem label="Application date">{formatDate(candidate.applicationDate)}</DetailItem>
        <DetailItem label="LinkedIn">
          {candidate.linkedinUrl ? <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer">Open profile ↗</a> : "Not provided"}
        </DetailItem>
        <DetailItem label="CV">
          {candidate.cvUrl ? <a href={candidate.cvUrl} target="_blank" rel="noreferrer">Open CV ↗</a> : "Not provided"}
        </DetailItem>
      </dl>
    </section>
  );
};

export default CandidateDetailsCard;
