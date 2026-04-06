"use client";

import { useEffect, useState } from "react";

type Patient = {
  id: string;
  studyCode: string;
  symptoms: string[];
  status: "urgent" | "attention" | "stable";
  updatedAt: number;
};

export default function HomePage() {
  const [studyCode, setStudyCode] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [status, setStatus] = useState<"urgent" | "attention" | "stable">("stable");
  const [saved, setSaved] = useState(false);

  function savePatient() {
    const existing = JSON.parse(localStorage.getItem("patients") || "[]") as Patient[];

    const nextPatient: Patient = {
      id: crypto.randomUUID(),
      studyCode: studyCode.trim() || "UNKNOWN",
      symptoms: symptoms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      status,
      updatedAt: Date.now(),
    };

    localStorage.setItem("patients", JSON.stringify([nextPatient, ...existing]));
    setSaved(true);
    setStudyCode("");
    setSymptoms("");
    setStatus("stable");
  }

  useEffect(() => {
    setSaved(false);
  }, [studyCode, symptoms, status]);

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-3xl font-bold">AFib Patient Check-In</h1>

        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Study Code</label>
            <input
              value={studyCode}
              onChange={(e) => setStudyCode(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="PT1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Symptoms (comma separated)
            </label>
            <input
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="palpitations, shortness of breath"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "urgent" | "attention" | "stable")
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="stable">Stable</option>
              <option value="attention">Attention</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <button
            onClick={savePatient}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Save Patient
          </button>

          {saved && <div className="text-sm text-green-600">Saved.</div>}
        </div>
      </div>
    </main>
  );
}