"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CandidateFormValues } from "@/types/candidate";
import FormInput from "./FormInput";

const blankValues: CandidateFormValues = {
  name: "",
  email: "",
  phone: "",
  position: "",
  linkedinUrl: "",
  cvUrl: "",
  yearsOfExperience: "",
  status: "",
  stage: "",
  applicationDate: new Date().toISOString().slice(0, 10),
};

interface CandidateFormProps {
  initialValues?: CandidateFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: CandidateFormValues) => Promise<void>;
}

const CandidateForm = ({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
}: CandidateFormProps) => {
  const [values, setValues] = useState(initialValues ?? blankValues);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValues(initialValues ?? blankValues);
  }, [initialValues]);

  const changeValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationError("");

    if (!values.name.trim() || !values.email.trim() || !values.position.trim()) {
      setValidationError("Name, email, and position are required.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    if (!values.status.trim() || !values.stage.trim()) {
      setValidationError("Candidate status and application stage are required.");
      return;
    }

    await onSubmit(values);
  };

  return (
    <form className="candidate-form" onSubmit={handleSubmit}>
      {validationError && <div className="feedback error">{validationError}</div>}

      <div className="form-grid">
        <FormInput label="Full name" name="name" value={values.name} required onChange={changeValue} />
        <FormInput label="Email" name="email" value={values.email} type="email" required onChange={changeValue} />
        <FormInput label="Phone" name="phone" value={values.phone} type="tel" onChange={changeValue} />
        <FormInput label="Position applied for" name="position" value={values.position} required onChange={changeValue} />
        <FormInput label="LinkedIn URL" name="linkedinUrl" value={values.linkedinUrl} type="url" onChange={changeValue} />
        <FormInput label="CV link" name="cvUrl" value={values.cvUrl} type="url" onChange={changeValue} />
        <FormInput label="Years of experience" name="yearsOfExperience" value={values.yearsOfExperience} type="number" min="0" onChange={changeValue} />
        <FormInput label="Status" name="status" value={values.status} required placeholder="e.g. active" onChange={changeValue} />
        <FormInput label="Application stage" name="stage" value={values.stage} required placeholder="e.g. screening" onChange={changeValue} />
        <FormInput label="Application date" name="applicationDate" value={values.applicationDate} type="date" required onChange={changeValue} />
      </div>

      <button className="button primary" type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default CandidateForm;
