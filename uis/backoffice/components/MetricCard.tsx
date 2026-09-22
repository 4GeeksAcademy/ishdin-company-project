interface MetricCardProps { label: string; value: string | number; helper?: string; }
export default function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}
