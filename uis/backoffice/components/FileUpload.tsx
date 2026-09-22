"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  file: File | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
}

export default function FileUpload({ file, disabled = false, onFileChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (candidate?: File) => {
    if (!candidate) return;
    const isCsv = candidate.name.toLowerCase().endsWith(".csv") || candidate.type === "text/csv";
    if (!isCsv) return onFileChange(null);
    onFileChange(candidate);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) acceptFile(e.dataTransfer.files?.[0]); }}
        className={`rounded-xl border-2 border-dashed p-8 text-center ${dragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-white"} ${disabled ? "opacity-60" : ""}`}
      >
        <p className="font-semibold text-slate-800">Drop your TrackFlow incident CSV here</p>
        <p className="mt-2 text-sm text-slate-500">or select a file from your computer</p>
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Choose CSV file
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" disabled={disabled}
          onChange={(e) => acceptFile(e.target.files?.[0])} />
      </div>

      {file && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3 text-sm">
          <span><strong>Selected:</strong> {file.name}</span>
          <button type="button" disabled={disabled} onClick={() => onFileChange(null)} className="font-medium text-rose-600">Remove</button>
        </div>
      )}
    </div>
  );
}
