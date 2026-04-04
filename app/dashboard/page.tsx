"use client";

import { useEffect, useMemo, useState } from "react";

type CheckinRow = {
  id: string;
  created_at: string;
  patient_name: string | null;
  patient_email: string | null;
  patient_dob: string | null;
  patient_id: string | null;
  result: string | null;
  chest_pain: boolean | null;
  dyspnea: string | null;
  lightheadedness: string | null;
  wants_care_team_contact: boolean | null;
  would_have_gone_to_ed: boolean | null;
  contacted: boolean | null;
  admin_notes: string | null;
  contacted_by: string | null;
  contacted_at: string | null;
  disposition: string | null;
};

type PatientFlag = {
  key: string;
  latestRowId: string;
  patient_name: string;
  patient_email: string;
  latest_result: string;
  latest_created_at: string;
  status: "urgent" | "attention" | "stable";
  reason: string;
  checkinsLast7Days: number;
  careTeamRequests: number;
  edDiversions: number;
  contacted: boolean;
  admin_notes: string;
  contacted_by: string;
  contacted_at: string | null;
  disposition: string;
};

const DISPOSITION_OPTIONS = [
  "",
  "Spoke to patient",
  "Left voicemail",
  "Adjusted meds",
  "Scheduled visit",
  "Sent to ED",
  "No action needed",
];

export default function DashboardPage() {
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingId, setSavingId] = useState("");
  const [teamMember, setTeamMember] = useState("");

  const [showOnlyCareRequests, setShowOnlyCareRequests] = useState(false);
  const [showOnlyRecent, setShowOnlyRecent] = useState(false);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("afib_admin_logged_in") === "true";

    if (!isLoggedIn) {
      window.location.href = "/admin-login";
      return;
    }

    const savedTeamMember = localStorage.getItem("afib_team_member") || "";
    setTeamMember(savedTeamMember);

    setAuthorized(true);
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("afib_team_member", teamMember);
  }, [teamMember]);

  async function fetchRows() {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error || "Unable to load dashboard.");
      } else {
        setRows((json.data as CheckinRow[]) || []);
      }
    } catch {
      setErrorMessage("Unable to load dashboard.");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!authorized) return;
    fetchRows();
  }, [authorized]);

  const flaggedPatients = useMemo(() => {
    const map = new Map<string, CheckinRow[]>();

    for (const row of rows) {
      const key =
        row.patient_id ||
        `${row.patient_email || "unknown"}__${row.patient_dob || "unknown"}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }

    const now = new Date();
    const result: PatientFlag[] = [];

    for (const [key, patientRows] of map.entries()) {
      const sorted = [...patientRows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const latest = sorted[0];

      const last7 = sorted.filter((r) => {
        const diff = now.getTime() - new Date(r.created_at).getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      });

      const checkinsLast7Days = last7.length;
      const careTeamRequests = last7.filter(
        (r) => r.wants_care_team_contact === true
      ).length;
      const edDiversions = last7.filter(
        (r) => r.would_have_gone_to_ed === true
      ).length;

      let status: "urgent" | "attention" | "stable" = "stable";
      let reason = "Stable symptoms";

      const urgent =
        latest.result?.includes("🔴") ||
        !!last7.find(
          (r) =>
            r.chest_pain ||
            r.lightheadedness === "syncope" ||
            r.dyspnea === "rest"
        );

      if (urgent) {
        status = "urgent";

        if (latest.result?.includes("🔴")) {
          reason = "Red event reported";
        } else if (last7.find((r) => r.chest_pain)) {
          reason = "Chest pain reported";
        } else if (last7.find((r) => r.lightheadedness === "syncope")) {
          reason = "Syncope reported";
        } else {
          reason = "Dyspnea at rest reported";
        }
      } else {
        const needsAttention =
          latest.result?.includes("🟡") ||
          checkinsLast7Days >= 3 ||
          careTeamRequests > 0 ||
          edDiversions > 0;

        if (needsAttention) {
          status = "attention";

          if (careTeamRequests > 0) {
            reason = "Requested care team contact";
          } else if (edDiversions > 0) {
            reason = "Would have gone to ED";
          } else if (checkinsLast7Days >= 3) {
            reason = "3+ check-ins in last 7 days";
          } else {
            reason = "Yellow event reported";
          }
        }
      }

      result.push({
        key,
        latestRowId: latest.id,
        patient_name: latest.patient_name || "Unknown",
        patient_email: latest.patient_email || "Unknown",
        latest_result: latest.result || "",
        latest_created_at: latest.created_at,
        status,
        reason,
        checkinsLast7Days,
        careTeamRequests,
        edDiversions,
        contacted: latest.contacted === true,
        admin_notes: latest.admin_notes || "",
        contacted_by: latest.contacted_by || "",
        contacted_at: latest.contacted_at || null,
        disposition: latest.disposition || "",
      });
    }

    return result.sort((a, b) => {
      if (a.contacted !== b.contacted) {
        return a.contacted ? 1 : -1;
      }

      const priority = { urgent: 0, attention: 1, stable: 2 };
      const statusCompare = priority[a.status] - priority[b.status];
      if (statusCompare !== 0) return statusCompare;

      return (
        new Date(b.latest_created_at).getTime() -
        new Date(a.latest_created_at).getTime()
      );
    });
  }, [rows]);

  const filteredPatients = useMemo(() => {
    let result = [...flaggedPatients];

    if (showOnlyCareRequests) {
      result = result.filter((p) => p.careTeamRequests > 0);
    }

    if (showOnlyRecent) {
      const now = new Date();
      result = result.filter((p) => {
        const diff = now.getTime() - new Date(p.latest_created_at).getTime();
        return diff <= 3 * 24 * 60 * 60 * 1000;
      });
    }

    return result;
  }, [flaggedPatients, showOnlyCareRequests, showOnlyRecent]);

  const activePatients = filteredPatients.filter((p) => !p.contacted);
  const completedPatients = filteredPatients.filter((p) => p.contacted);

  const urgentPatients = activePatients.filter((p) => p.status === "urgent");
  const attentionPatients = activePatients.filter(
    (p) => p.status === "attention"
  );
  const stablePatients = activePatients.filter((p) => p.status === "stable");

  async function savePatientUpdate(
    id: string,
    contacted: boolean,
    admin_notes: string,
    disposition: string
  ) {
    setSavingId(id);

    try {
      const res = await fetch("/api/dashboard/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          contacted,
          admin_notes,
          contacted_by: contacted ? teamMember : "",
          disposition,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "Unable to save update.");
      } else {
        await fetchRows();
      }
    } catch {
      alert("Unable to save update.");
    }

    setSavingId("");
  }

  function handleLogout() {
    localStorage.removeItem("afib_admin_logged_in");
    window.location.href = "/admin-login";
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-6 text-black">
        <p>Checking access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Physician Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Prioritized AF patient review
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            Admin Logout
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Team member using dashboard
          </label>
          <input
            type="text"
            value={teamMember}
            onChange={(e) => setTeamMember(e.target.value)}
            placeholder="e.g. Nikhil, Sarah NP, Jenny RN"
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-black"
          />
        </div>

        {loading ? (
          <p>Loading dashboard...</p>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
            {errorMessage}
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
              <SummaryCard label="Urgent" value={String(urgentPatients.length)} />
              <SummaryCard
                label="Needs Attention"
                value={String(attentionPatients.length)}
              />
              <SummaryCard label="Stable" value={String(stablePatients.length)} />
              <SummaryCard
                label="Completed Today"
                value={String(completedPatients.length)}
              />
              <SummaryCard
                label="Active Work"
                value={String(activePatients.length)}
              />
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="mb-3 text-lg font-semibold">Filters</div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showOnlyCareRequests}
                    onChange={(e) => setShowOnlyCareRequests(e.target.checked)}
                  />
                  Show only care team requests
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showOnlyRecent}
                    onChange={(e) => setShowOnlyRecent(e.target.checked)}
                  />
                  Show only last 3 days
                </label>
              </div>
            </div>

            <Section title="Urgent" emptyText="No urgent patients right now.">
              {urgentPatients.map((patient) => (
                <PatientCard
                  key={patient.key}
                  patient={patient}
                  saving={savingId === patient.latestRowId}
                  onSave={savePatientUpdate}
                />
              ))}
            </Section>

            <Section
              title="Needs Attention"
              emptyText="No patients needing follow-up right now."
            >
              {attentionPatients.map((patient) => (
                <PatientCard
                  key={patient.key}
                  patient={patient}
                  saving={savingId === patient.latestRowId}
                  onSave={savePatientUpdate}
                />
              ))}
            </Section>

            <Section title="Stable" emptyText="No stable patients to display.">
              {stablePatients.map((patient) => (
                <PatientCard
                  key={patient.key}
                  patient={patient}
                  saving={savingId === patient.latestRowId}
                  onSave={savePatientUpdate}
                />
              ))}
            </Section>

            <Section
              title="Completed Today"
              emptyText="No completed follow-up actions yet."
            >
              {completedPatients.map((patient) => (
                <PatientCard
                  key={patient.key}
                  patient={patient}
                  saving={savingId === patient.latestRowId}
                  onSave={savePatientUpdate}
                />
              ))}
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : !!children;

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {hasChildren ? (
        <div className="space-y-4">{children}</div>
      ) : (
        <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function PatientCard({
  patient,
  saving,
  onSave,
}: {
  patient: PatientFlag;
  saving: boolean;
  onSave: (
    id: string,
    contacted: boolean,
    admin_notes: string,
    disposition: string
  ) => void;
}) {
  const [contacted, setContacted] = useState(patient.contacted);
  const [notes, setNotes] = useState(patient.admin_notes);
  const [disposition, setDisposition] = useState(patient.disposition);

  const statusClass =
    patient.status === "urgent"
      ? "text-red-600"
      : patient.status === "attention"
      ? "text-yellow-700"
      : "text-green-700";

  return (
    <div className="rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-lg font-semibold">{patient.patient_name}</div>
            <div className="text-sm text-gray-500">{patient.patient_email}</div>
            <div className="mt-2 text-sm">
              <strong>Reason:</strong> {patient.reason}
            </div>
            <div className="mt-1 text-sm">
              <strong>Latest result:</strong> {patient.latest_result}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {new Date(patient.latest_created_at).toLocaleString()}
            </div>
            {patient.contacted && (
              <div className="mt-2 text-sm text-gray-700">
                <strong>Completed by:</strong>{" "}
                {patient.contacted_by || "Unknown"}
                {patient.contacted_at
                  ? ` • ${new Date(patient.contacted_at).toLocaleString()}`
                  : ""}
              </div>
            )}
            {patient.disposition && (
              <div className="mt-1 text-sm text-gray-700">
                <strong>Disposition:</strong> {patient.disposition}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[260px]">
            <div>
              <div className="text-gray-500">Status</div>
              <div className={`font-semibold ${statusClass}`}>
                {patient.status === "urgent"
                  ? "Urgent"
                  : patient.status === "attention"
                  ? "Needs Attention"
                  : "Stable"}
              </div>
            </div>

            <div>
              <div className="text-gray-500">Last 7 Days</div>
              <div className="font-semibold">{patient.checkinsLast7Days}</div>
            </div>

            <div>
              <div className="text-gray-500">Care Requests</div>
              <div className="font-semibold">{patient.careTeamRequests}</div>
            </div>

            <div>
              <div className="text-gray-500">ED Diversions</div>
              <div className="font-semibold">{patient.edDiversions}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={contacted}
              onChange={(e) => setContacted(e.target.checked)}
            />
            Mark as contacted
          </label>

          <div className="mb-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Disposition
            </label>
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
            >
              {DISPOSITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option || "Select disposition"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
              placeholder="Add follow-up notes here..."
            />
          </div>

          <button
            onClick={() =>
              onSave(patient.latestRowId, contacted, notes, disposition)
            }
            disabled={saving}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Update"}
          </button>
        </div>
      </div>
    </div>
  );
}