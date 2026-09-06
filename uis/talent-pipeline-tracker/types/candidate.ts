export type CandidateId = string | number;

export interface CandidateApiRecord {
  id: CandidateId;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  position?: string;
  linkedin?: string | null;
  linkedin_url?: string | null;
  cv_link?: string | null;
  cv_url?: string | null;
  experience_years?: number | string | null;
  years_of_experience?: number | string | null;
  status?: string;
  stage?: string;
  applied_at?: string;
  application_date?: string;
  created_at?: string;
}

export interface Candidate {
  id: CandidateId;
  name: string;
  email: string;
  phone: string;
  position: string;
  linkedinUrl: string;
  cvUrl: string;
  yearsOfExperience: number | null;
  status: string;
  stage: string;
  applicationDate: string;
}

export interface CandidateSingleApiResponse {
  record?: CandidateApiRecord;
  data?: CandidateApiRecord;
}

export interface NoteSingleApiResponse {
  note?: NoteApiRecord;
  data?: NoteApiRecord;
}

export interface CandidateListApiResponse {
  records?: CandidateApiRecord[];
  items?: CandidateApiRecord[];
  data?: CandidateApiRecord[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface CandidateFormValues {
  name: string;
  email: string;
  phone: string;
  position: string;
  linkedinUrl: string;
  cvUrl: string;
  yearsOfExperience: string;
  status: string;
  stage: string;
  applicationDate: string;
}

export interface CandidateWritePayload {
  full_name: string;
  experience_years: number | null;
  name: string;
  email: string;
  phone: string;
  position: string;
  linkedin: string;
  linkedin_url: string;
  cv_link: string;
  cv_url: string;
  years_of_experience: number | null;
  status: string;
  stage: string;
  application_date: string;
}

export interface CandidatePatchPayload {
  status?: string;
  stage?: string;
}

export interface NoteApiRecord {
  id: CandidateId;
  content?: string;
  note?: string;
  text?: string;
  created_at?: string;
  author?: string;
}

export interface CandidateNote {
  id: CandidateId;
  content: string;
  createdAt: string;
  author: string;
}

export interface NotesApiResponse {
  notes?: NoteApiRecord[];
  items?: NoteApiRecord[];
  data?: NoteApiRecord[];
}
