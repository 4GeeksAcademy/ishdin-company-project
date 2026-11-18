import { track } from "@/services/telemetry";

import type {
  TelemetryWarehouse,
} from "@/services/inventoryTelemetry";


const WORKFLOW_INACTIVITY_MS = 60_000;


interface ActiveWorkflow {
  startedAt: number;
  lastActivityAt: number;
  lastStep: string;
  timeoutId: ReturnType<typeof setTimeout> | null;
}


const activeWorkflows =
  new Map<string, ActiveWorkflow>();


function scheduleAbandonment(
  workflowName: string,
): void {
  const active =
    activeWorkflows.get(workflowName);

  if (!active) {
    return;
  }

  if (active.timeoutId) {
    clearTimeout(active.timeoutId);
  }

  active.timeoutId = setTimeout(() => {
    const current =
      activeWorkflows.get(workflowName);

    if (!current) {
      return;
    }

    const elapsedMs = Math.max(
      0,
      Date.now() - current.startedAt,
    );

    track(
      "workflow_abandoned",
      {
        workflow_name: workflowName,
        last_step: current.lastStep,
        elapsed_ms: elapsedMs,
      },
    );

    activeWorkflows.delete(
      workflowName,
    );
  }, WORKFLOW_INACTIVITY_MS);
}


export function startWorkflow(
  workflowName: string,
): void {
  const name = workflowName.trim();

  if (!name) {
    return;
  }

  if (activeWorkflows.has(name)) {
    return;
  }

  const now = Date.now();

  activeWorkflows.set(
    name,
    {
      startedAt: now,
      lastActivityAt: now,
      lastStep: "workflow_opened",
      timeoutId: null,
    },
  );

  track(
    "workflow_started",
    {
      workflow_name: name,
    },
  );

  scheduleAbandonment(name);
}


export function touchWorkflow(
  workflowName: string,
  lastStep: string,
): void {
  const name = workflowName.trim();

  let active =
    activeWorkflows.get(name);

  /*
   * If the workflow had previously timed out and
   * the operator resumes working, this becomes a
   * new workflow attempt.
   */
  if (!active) {
    startWorkflow(name);
    active = activeWorkflows.get(name);
  }

  if (!active) {
    return;
  }

  active.lastActivityAt = Date.now();
  active.lastStep = lastStep;

  scheduleAbandonment(name);
}


export function completeWorkflow(
  workflowName: string,
  warehouse?: TelemetryWarehouse,
): void {
  const name = workflowName.trim();

  const active =
    activeWorkflows.get(name);

  if (!active) {
    return;
  }

  if (active.timeoutId) {
    clearTimeout(active.timeoutId);
  }

  const durationMs = Math.max(
    0,
    Date.now() - active.startedAt,
  );

  const properties: Record<
    string,
    unknown
  > = {
    workflow_name: name,
    duration_ms: durationMs,
  };

  if (warehouse) {
    properties.warehouse = warehouse;
  }

  track(
    "workflow_completed",
    properties,
  );

  activeWorkflows.delete(name);
}