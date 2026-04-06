"use client";

import { useEffect, useState } from "react";

type Patient = {
  id: string;
  studyCode: string;
  symptoms: string[];
  status: "urgent" | "attention" | "stable";
  updatedAt: number;
};

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);

  // Load patients from localStorage
  const loadPatients = () => {
    try {
      const data = localStorage.getItem("patients");
      if (data) {
        setPatients(JSON.parse(data));
      } else {
        setPatients([]);
      }
    } catch {
      setPatients([]);
    }
  };

  // Initial load + auto refresh
  useEffect(() => {
    loadPatients();
    const interval = setInterval(loadPatients, 2000);
    return () => clearInterval(interval);
  }, []);

  // Counts
  const urgent = patients.filter(p => p.status === "urgent");
  const attention = patients.filter(p => p.status === "attention");
  const stable = patients.filter(p => p.status === "stable");

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1 style={{ marginBottom: 20 }}>AFib Dashboard</h1>

      {/* Summary */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div style={{ color: "red", fontWeight: "bold" }}>
          Urgent: {urgent.length}
        </div>
        <div style={{ color: "orange", fontWeight: "bold" }}>
          Attention: {attention.length}
        </div>
        <div style={{ color: "green", fontWeight: "bold" }}>
          Stable: {stable.length}
        </div>
      </div>

      {/* Patient List */}
      <div>
        {patients.length === 0 && (
          <div>No patients yet</div>
        )}

        {patients.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              Study: {p.studyCode || "N/A"}
            </div>

            <div style={{ fontSize: 14, marginTop: 4 }}>
              Symptoms: {p.symptoms?.join(", ") || "None"}
            </div>

            <div
              style={{
                marginTop: 6,
                fontWeight: "bold",
                color:
                  p.status === "urgent"
                    ? "red"
                    : p.status === "attention"
                    ? "orange"
                    : "green",
              }}
            >
              {p.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}