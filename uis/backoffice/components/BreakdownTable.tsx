interface BreakdownTableProps { title: string; items: Array<{ label: string; value: number }>; }
export default function BreakdownTable({ title, items }: BreakdownTableProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2></div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm text-slate-600">{item.label}</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
