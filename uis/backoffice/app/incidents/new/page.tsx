import { IncidentNav } from "@/components/incidents/IncidentNav";
import { IncidentRegistrationForm } from "@/components/incidents/IncidentRegistrationForm";

export default function NewIncidentPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            TrackFlow backoffice
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-emerald-800">
            Register an incident
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Submit a new incident directly to the centralized registry.
          </p>
        </div>

        <IncidentNav />
      </header>

      <IncidentRegistrationForm />
    </main>
  );
}
