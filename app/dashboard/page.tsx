"use client";

import { useEffect, useState } from "react";
import {
  getAllPatients,
  DASHBOARD_STATUS_KEY,
  type StoredCheckIn,
} from "@/lib/storage";

type DashboardStatus = Record<
  string,
  {
    contacted: boolean;
    admin_notes: string;
    contacted_by: string;
    contacted_at: string | null;
  }
>;

type PatientRow = {
  studyCode: string;
  weeksSinceAblation: number | "";
  latest: StoredCheckIn | null;
  checkinsLast7Days: number;
  status: "urgent" | "attention" | "stable";
  reason: string;
  contacted: boolean;
  admin_notes: string;
  contacted_by: string;
  contacted_at: string | null;
};

function loadDashboardStatus(): DashboardStatus {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DASHBOARD_STATUS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDashboardStatus(status: DashboardStatus) {
  localStorage.setItem(DASHBOARD_STATUS_KEY, JSON.stringify(status));
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [statusMap, setStatusMap] = useState<DashboardStatus>({});
  const [teamMember, setTeamMember] = useState("");

  function reloadDashboard() {
    const all = getAllPatients();
    const statuses = loadDashboardStatus();
    setStatusMap(statuses);

    const rows: PatientRow[] = all
      .map(({ studyCode, profile, checkIns }) => {
        const latest = checkIns[0] || null;
        if (!latest) return null;

        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const checkinsLast7Days = checkIns.filter(
          (c) => new Date(c.created_at).getTime() >= cutoff
        ).length;

        let status: "urgent" | "attention" | "stable" = "stable";
        let reason = "Stable";

        if (
          latest.result === "red" ||
          latest.chestPain ||
          latest.lightheadedness === "syncope" ||
          latest.shortnessOfBreath === "rest"
        ) {
          status = "urgent";
          reason = "High-risk symptoms";
        } else if (latest.result === "yellow" || checkinsLast7Days >= 3) {
          status = "attention";
          reason = "Needs follow-up";
        }

        const persisted = statuses[studyCode] || {
          contacted: false,
          admin_notes: "",
          contacted_by: "",
          contacted_at: null,
        };

        return {
          studyCode,
          weeksSinceAblation: profile.weeksSinceAblation,
          latest,
          checkinsLast7Days,
          status,
          reason,
          contacted: persisted.contacted,
          admin_notes: persisted.admin_notes,
          contacted_by: persisted.contacted_by,
          contacted_at: persisted.contacted_at,
        };
      })
      .filter(Boolean) as PatientRow[];

    setPatients(rows);
  }

  useEffect(() => {
    reloadDashboard();

    const interval = setInterval(() => {
      reloadDashboard();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadDashboard();
      }
    };

    const handleFocus = () => {
      reloadDashboard();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function updatePatient(
    studyCode: string,
    contacted: boolean,
    admin_notes: string
  ) {
    const next = {
      ...statusMap,
      [studyCode]: {
        contacted,
        admin_notes,
        contacted_by: contacted ? teamMember : "",
        contacted_at: contacted ? new Date().toISOString() : null,
      },
    };

    setStatusMap(next);
    saveDashboardStatus(next);

    setPatients((prev) =>
      prev.map((p) =>
        p.studyCode === studyCode
          ? {
              ...p,
              contacted,
              admin_notes,
              contacted_by: next[studyCode].contacted_by,
              contacted_at: next[studyCode].contacted_at,
            }
          : p
      )
    );
  }

  const active = patients.filter((p) => !p.contacted);
  const completed = patients.filter((p) => p.contacted);

  const urgent = active.filter((p) => p.status === "urgent");
  const attention = active.filter((p) => p.status === "attention");
  const stable = active.filter((p) => p.status === "stable");

  return (
    <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Care Dashboard</h1>

          <button
            onClick={reloadDashboard}
            className="border px-3 py-1 rounded-md text-sm"
          >
            Refresh
          </button>
        </div>

        <input
          type="text"
          value={teamMember}
          onChange={(e) => setTeamMember(e.target.value)}
          placeholder="Your name"
          className="border px-3 py-2 rounded-md w-full max-w-sm"
        />

        <div className="grid grid-cols-3 gap-3 text-center">
          <Summary label="Urgent" value={urgent.length} color="red" />
          <Summary label="Attention" value={attention.length} color="yellow" />
          <Summary label="Stable" value={stable.length} color="green" />
        </div>

        <Section title="Urgent" data={urgent} color="red" onSave={updatePatient} />
        <Section
          title="Needs Attention"
          data={attention}
          color="yellow"
          onSave={updatePatient}
        />
        <Section title="Stable" data={stable} color="green" onSave={updatePatient} />

        {completed.length > 0 && (
          <Section
            title="Completed"
            data={completed}
            color="gray"
            onSave={updatePatient}
          />
        )}
      </div>
    </main>
  );
}

function Summary({ label, value, color }: any) {
  const colors = {
    red: "text-red-600",
    yellow: "text-yellow-600",
    green: "text-green-600",
  };

  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}

function Section({ title, data, color, onSave }: any) {
  if (data.length === 0) return null;

  const border = {
    red: "border-red-300",
    yellow: "border-yellow-300",
    green: "border-green-300",
    gray: "border-gray-300",
  };

  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className={`space-y-2 border-l-4 pl-3 ${border[color]}`}>
        {data.map((p: any) => (
          <Card key={p.studyCode} p={p} onSave={onSave} />
        ))}
      </div>
    </div>
  );
}

function Card({ p, onSave }: any) {
  const [contacted, setContacted] = useState(p.contacted);
  const [notes, setNotes] = useState(p.admin_notes);

  useEffect(() => {
    setContacted(p.contacted);
    setNotes(p.admin_notes);
  }, [p.contacted, p.admin_notes]);

  return (
    <div className="border rounded-lg p-3 bg-white text-sm">
      <div className="font-semibold">{p.studyCode}</div>
      <div className="text-gray-500">Week {p.weeksSinceAblation}</div>
      <div>{p.reason}</div>

      {p.latest && <div className="text-gray-600 mt-1">{p.latest.summary}</div>}

      <div className="mt-2 flex gap-2">
        <input
          type="checkbox"
          checked={contacted}
          onChange={(e) => setContacted(e.target.checked)}
        />
        <span>Contacted</span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        className="border mt-2 w-full p-1 rounded"
      />

      <button
        onClick={() => onSave(p.studyCode, contacted, notes)}
        className="mt-2 bg-black text-white px-3 py-1 rounded"
      >
        Save
      </button>
    </div>
  );
}