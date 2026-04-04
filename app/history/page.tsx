"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Checkin = {
  id: string;
  created_at: string;
  result: string | null;
  would_have_gone_to_ed: boolean | null;
};

function getPatientId() {
  return localStorage.getItem("patientId") || "";
}

export default function HistoryPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const patientId = getPatientId();

    if (!patientId) {
      setError("No patient ID found");
      setLoading(false);
      return;
    }

    fetch(`/api/history?patient_id=${encodeURIComponent(patientId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRows(data.data || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load history");
        setLoading(false);
      });
  }, []);

  const total = rows.length;
  const last7 = rows.filter((r) => {
    const d = new Date(r.created_at);
    return Date.now() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const yellow = rows.filter((r) => r.result?.includes("🟡")).length;
  const red = rows.filter((r) => r.result?.includes("🔴")).length;
  const ed = rows.filter((r) => r.would_have_gone_to_ed).length;

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Check-In History</h1>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"
          >
            ← Back
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card label="Total" value={total} />
          <Card label="Last 7 Days" value={last7} />
          <Card label="Yellow" value={yellow} />
          <Card label="Red" value={red} />
          <Card label="ED" value={ed} />
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && rows.length === 0 && <p>No check-ins yet.</p>}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border bg-white p-4">
              <div className="text-sm text-gray-500">
                {new Date(row.created_at).toLocaleString()}
              </div>
              <div className="mt-1 font-medium">{row.result}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 text-center">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}