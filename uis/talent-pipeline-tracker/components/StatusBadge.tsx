import { formatLabel } from "@/lib/format";

interface StatusBadgeProps {
  value: string;
  kind?: "status" | "stage";
}

const StatusBadge = ({ value, kind = "status" }: StatusBadgeProps) => {
  return (
    <span className={`badge ${kind}`}>
      {value ? formatLabel(value) : "Not set"}
    </span>
  );
};

export default StatusBadge;
