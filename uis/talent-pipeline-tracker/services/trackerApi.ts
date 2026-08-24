import type {
  Candidate,
  CandidateApiRecord,
  CandidateFormValues,
  CandidateId,
  CandidateListApiResponse,
  CandidateSingleApiResponse,
  CandidateNote,
  CandidatePatchPayload,
  CandidateWritePayload,
  NoteApiRecord,
  NoteSingleApiResponse,
  NotesApiResponse,
} from "@/types/candidate";

const API_BASE =
  process.env.NEXT_PUBLIC_TRACKER_API_BASE_URL ??
  "https://playground.4geeks.com/tracker/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const parseErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;

  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return String(item);
      })
      .join(", ");
  }

  return fallback;
};

const requestJson = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(
      parseErrorMessage(payload, `Request failed with status ${response.status}.`),
      response.status,
    );
  }

  return payload as T;
};

const normalizeCandidate = (raw: CandidateApiRecord): Candidate => {
  const composedName = [raw.first_name, raw.last_name]
    .filter(Boolean)
    .join(" ");

  const yearsValue = raw.years_of_experience;
  const parsedYears =
    yearsValue === null || yearsValue === undefined || yearsValue === ""
      ? null
      : Number(yearsValue);

  return {
    id: raw.id,
    name: raw.name ?? raw.full_name ?? composedName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    position: raw.position ?? "",
    linkedinUrl: raw.linkedin ?? raw.linkedin_url ?? "",
    cvUrl: raw.cv_link ?? raw.cv_url ?? "",
    yearsOfExperience: Number.isNaN(parsedYears) ? null : parsedYears,
    status: raw.status ?? "",
    stage: raw.stage ?? "",
    applicationDate: raw.application_date ?? raw.created_at ?? "",
  };
};

const extractRecordArray = (
  payload: CandidateApiRecord[] | CandidateListApiResponse,
) => {
  if (Array.isArray(payload)) return payload;
  return payload.records ?? payload.items ?? payload.data ?? [];
};

const extractCandidate = (
  payload: CandidateApiRecord | CandidateSingleApiResponse,
) => {
  if ("id" in payload) return normalizeCandidate(payload);
  const record = payload.record ?? payload.data;
  if (!record) throw new ApiError("Candidate data was missing from the response.", 500);
  return normalizeCandidate(record);
};

const normalizeNote = (raw: NoteApiRecord): CandidateNote => ({
  id: raw.id,
  content: raw.content ?? raw.note ?? raw.text ?? "",
  createdAt: raw.created_at ?? "",
  author: raw.author ?? "People & Talent",
});

const toWritePayload = (
  values: CandidateFormValues,
): CandidateWritePayload => ({
  name: values.name.trim(),
  email: values.email.trim(),
  phone: values.phone.trim(),
  position: values.position.trim(),
  linkedin: values.linkedinUrl.trim(),
  cv_link: values.cvUrl.trim(),
  years_of_experience: values.yearsOfExperience
    ? Number(values.yearsOfExperience)
    : null,
  status: values.status.trim(),
  stage: values.stage.trim(),
  application_date: values.applicationDate,
});

export const getCandidates = async () => {
  const payload = await requestJson<
    CandidateApiRecord[] | CandidateListApiResponse
  >("/records");
  return extractRecordArray(payload).map(normalizeCandidate);
};

export const getCandidate = async (id: CandidateId) => {
  const payload = await requestJson<
    CandidateApiRecord | CandidateSingleApiResponse
  >(`/records/${id}`);
  return extractCandidate(payload);
};

export const createCandidate = async (values: CandidateFormValues) => {
  const payload = await requestJson<
    CandidateApiRecord | CandidateSingleApiResponse | undefined
  >("/records", {
    method: "POST",
    body: JSON.stringify(toWritePayload(values)),
  });

  return payload ? extractCandidate(payload) : null;
};

export const updateCandidate = async (
  id: CandidateId,
  values: CandidateFormValues,
) => {
  const payload = await requestJson<
    CandidateApiRecord | CandidateSingleApiResponse | undefined
  >(`/records/${id}`, {
    method: "PUT",
    body: JSON.stringify(toWritePayload(values)),
  });

  return payload ? extractCandidate(payload) : getCandidate(id);
};

export const patchCandidate = async (
  id: CandidateId,
  changes: CandidatePatchPayload,
) => {
  const payload = await requestJson<
    CandidateApiRecord | CandidateSingleApiResponse | undefined
  >(`/records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

  return payload ? extractCandidate(payload) : getCandidate(id);
};

export const getNotes = async (candidateId: CandidateId) => {
  const payload = await requestJson<NoteApiRecord[] | NotesApiResponse>(
    `/records/${candidateId}/notes`,
  );
  const rawNotes = Array.isArray(payload)
    ? payload
    : payload.notes ?? payload.items ?? payload.data ?? [];
  return rawNotes.map(normalizeNote);
};

export const addNote = async (
  candidateId: CandidateId,
  content: string,
) => {
  const payload = await requestJson<
    NoteApiRecord | NoteSingleApiResponse
  >(`/records/${candidateId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content: content.trim() }),
  });

  if ("id" in payload) return normalizeNote(payload);
  const note = payload.note ?? payload.data;
  if (!note) throw new ApiError("The note response was empty.", 500);
  return normalizeNote(note);
};

export const deleteNote = async (
  candidateId: CandidateId,
  noteId: CandidateId,
) => {
  await requestJson<unknown>(
    `/records/${candidateId}/notes/${noteId}`,
    { method: "DELETE" },
  );
};
