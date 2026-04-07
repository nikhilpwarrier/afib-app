"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Status = "urgent" | "attention" | "stable";
type OutreachStatus = "new" | "attempted" | "called" | "resolved";

type PatientRecord = {
  id: string;
  study_code: string;
  ablation_date: string;
  weeks_since_ablation: number;
  no_symptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chest_pain: boolean;
  shortness_of_breath: "none" | "activity" | "rest";
  precipitating_factor: "none" | "exertion" | "stress" | "missed_meds" | "unknown";
  clinic_contact_me: boolean;
  status: Status;
  summary: string;
  created_at: string;
};

type DashboardMeta = Record<
  string,
  {
    outreachStatus: OutreachStatus;
    notes: string;
  }
>;

const ADMIN_SESSION_KEY = "atria_admin_auth";

function saveDashboardMeta(meta: DashboardMeta) {
  localStorage.setItem("dashboard_meta", JSON.stringify(meta));
}

function loadDashboardMeta(): DashboardMeta {
  try {
    const raw = localStorage.getItem("dashboard_meta");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function severityLabel(status: Status) {
  if (status === "urgent") return "Urgent";
  if (status === "attention") return "Needs Attention";
  return "Stable";
}

function severityColor(status: Status) {
  if (status === "urgent") return "#dc2626";
  if (status === "attention") return "#d97706";
  return "#16a34a";
}

function severityBg(status: Status) {
  if (status === "urgent") return "#fef2f2";
  if (status === "attention") return "#fffbeb";
  return "#f0fdf4";
}

function severityBorder(status: Status) {
  if (status === "urgent") return "#fecaca";
  if (status === "attention") return "#fde68a";
  return "#bbf7d0";
}

function outreachLabel(status: OutreachStatus) {
  if (status === "attempted") return "Attempted";
  if (status === "called") return "Reached";
  if (status === "resolved") return "Resolved";
  return "New";
}

function timeAgo(value: string) {
  const ts = new Date(value).getTime();
  const diff = Math.floor((Date.now() - ts) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function buildAlertReason(patient: PatientRecord) {
  if (patient.status === "urgent") {
    if (patient.chest_pain) return "Chest pain reported";
    if (patient.shortness_of_breath === "rest") return "Shortness of breath at rest";
    if (patient.palpitations === "severe" && patient.duration === "over_30") {
      return "Severe palpitations > 30 minutes";
    }
    return "High-risk symptoms";
  }

  if (patient.status === "attention") {
    if (patient.clinic_contact_me) return "Requested clinic contact";
    if (patient.shortness_of_breath === "activity") return "Shortness of breath with activity";
    if (patient.palpitations === "moderate") return "Moderate palpitations";
    if (patient.palpitations === "severe") return "Severe palpitations";
    if (patient.duration === "5_30") return "Symptoms 5–30 minutes";
    if (patient.duration === "over_30") return "Symptoms > 30 minutes";
    return "Needs follow-up";
  }

  return "No urgent concerns";
}

function sortPatients(patients: PatientRecord[], meta: DashboardMeta) {
  const severityRank: Record<Status, number> = {
    urgent: 0,
    attention: 1,
    stable: 2,
  };

  const outreachRank: Record<OutreachStatus, number> = {
    new: 0,
    attempted: 1,
    called: 2,
    resolved: 3,
  };

  return [...patients].sort((a, b) => {
    const aMeta = meta[a.id] || {
      outreachStatus: "new" as OutreachStatus,
      notes: "",
    };
    const bMeta = meta[b.id] || {
      outreachStatus: "new" as OutreachStatus,
      notes: "",
    };

    if (aMeta.outreachStatus !== bMeta.outreachStatus) {
      return outreachRank[aMeta.outreachStatus] - outreachRank[bMeta.outreachStatus];
    }

    if (a.status !== b.status) {
      return severityRank[a.status] - severityRank[b.status];
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function ActionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: active ? "1px solid #111827" : "1px solid #d4d4d4",
        background: active ? "#111827" : "white",
        color: active ? "white" : "#111827",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  valueColor,
  background,
  border,
}: {
  label: string;
  value: number;
  valueColor: string;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background,
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#64748b", marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        color: "#64748b",
        marginBottom: 30,
        background: "white",
      }}
    >
      {text}
    </div>
  );
}

function PrototypeFooter() {
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: "1px solid #e5e7eb",
        color: "#64748b",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      Internal prototype for pilot evaluation only. Do not use as the sole
      source of clinical decision-making. Do not enter patient names, MRNs,
      dates of birth, or other direct identifiers.
    </div>
  );
}

function PatientCard({
  patient,
  outreachStatus,
  notes,
  onUpdateMeta,
}: {
  patient: PatientRecord;
  outreachStatus: OutreachStatus;
  notes: string;
  onUpdateMeta: (
    id: string,
    patch: { outreachStatus?: OutreachStatus; notes?: string }
  ) => void;
}) {
  const [localNotes, setLocalNotes] = useState(notes);

  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const reason = buildAlertReason(patient);

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid #e5e7eb",
        background: "white",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: severityColor(patient.status),
        }}
      />

      <div style={{ paddingLeft: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {patient.study_code}
              {outreachStatus === "new" && (
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  NEW
                </span>
              )}
              {patient.clinic_contact_me && (
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#fde68a",
                    color: "#92400e",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  CALLBACK
                </span>
              )}
            </div>

            <div style={{ color: "#64748b", marginTop: 4 }}>
              Post-procedure • Week {patient.weeks_since_ablation}
            </div>

            <div style={{ color: "#64748b", marginTop: 4 }}>
              Procedure date: {patient.ablation_date}
            </div>

            <div style={{ color: "#64748b", marginTop: 4 }}>
              Updated {timeAgo(patient.created_at)}
            </div>
          </div>

          <div
            style={{
              background: severityBg(patient.status),
              border: `1px solid ${severityBorder(patient.status)}`,
              color: severityColor(patient.status),
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {severityLabel(patient.status)}
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
            Alert Reason
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{reason}</div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              color:
                patient.status === "urgent"
                  ? "#dc2626"
                  : patient.status === "attention"
                  ? "#d97706"
                  : "#16a34a",
            }}
          >
            {patient.status === "urgent" && "→ Same-day follow-up recommended"}
            {patient.status === "attention" && "→ Follow-up within 24 hours"}
            {patient.status === "stable" && "→ No action needed"}
          </div>

          <div style={{ color: "#334155", lineHeight: 1.5 }}>{patient.summary}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
            Outreach Status
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionButton
              label="New"
              active={outreachStatus === "new"}
              onClick={() => onUpdateMeta(patient.id, { outreachStatus: "new" })}
            />
            <ActionButton
              label="Attempted"
              active={outreachStatus === "attempted"}
              onClick={() =>
                onUpdateMeta(patient.id, { outreachStatus: "attempted" })
              }
            />
            <ActionButton
              label="Reached"
              active={outreachStatus === "called"}
              onClick={() => onUpdateMeta(patient.id, { outreachStatus: "called" })}
            />
            <ActionButton
              label="Resolved"
              active={outreachStatus === "resolved"}
              onClick={() =>
                onUpdateMeta(patient.id, { outreachStatus: "resolved" })
              }
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
            Care Team Notes
          </div>
          <textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Document callback attempt, recommendations, follow-up plan..."
            style={{
              width: "100%",
              minHeight: 90,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #d4d4d4",
              resize: "vertical",
              fontFamily: "Arial, sans-serif",
            }}
          />
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => onUpdateMeta(patient.id, { notes: localNotes })}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save Note
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
          Current workflow status: <strong>{outreachLabel(outreachStatus)}</strong>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [meta, setMeta] = useState<DashboardMeta>({});

  async function loadPatientsFromDB() {
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }

    return (data || []) as PatientRecord[];
  }

  async function refresh() {
    const data = await loadPatientsFromDB();
    setPatients(data);
    setMeta(loadDashboardMeta());
  }

  useEffect(() => {
    const existing =
      typeof window !== "undefined"
        ? localStorage.getItem(ADMIN_SESSION_KEY)
        : null;

    if (existing !== "true") {
      router.replace("/admin-login");
      return;
    }

    setAuthorized(true);
    refresh();

    const interval = setInterval(() => {
      refresh();
    }, 5000);

    const handleFocus = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  const sortedPatients = useMemo(
    () => sortPatients(patients, meta),
    [patients, meta]
  );

  const openAlerts = sortedPatients.filter(
    (p) => (meta[p.id]?.outreachStatus || "new") !== "resolved" && p.status !== "stable"
  );

  const urgentAlerts = openAlerts.filter((p) => p.status === "urgent");
  const attentionAlerts = openAlerts.filter((p) => p.status === "attention");

  const attemptedAlerts = sortedPatients.filter(
    (p) => meta[p.id]?.outreachStatus === "attempted"
  );

  const resolvedAlerts = sortedPatients.filter(
    (p) => meta[p.id]?.outreachStatus === "resolved"
  );

  function updateMeta(id: string, patch: Partial<DashboardMeta[string]>) {
    const next: DashboardMeta = {
      ...meta,
      [id]: {
        outreachStatus: meta[id]?.outreachStatus || "new",
        notes: meta[id]?.notes || "",
        ...patch,
      },
    };

    setMeta(next);
    saveDashboardMeta(next);
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    router.push("/admin-login");
  }

  if (!authorized) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 24,
        color: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 24,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 14,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>AtriaCare</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
              Admin Dashboard
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827" }}>
              Check-In
            </a>
            <a
              href="/dashboard"
              style={{
                textDecoration: "none",
                color: "#111827",
                fontWeight: 700,
              }}
            >
              Dashboard
            </a>
            <button
              type="button"
              onClick={refresh}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          Internal prototype for pilot evaluation only. Do not use as the sole
          source of clinical decision-making. Do not enter direct patient
          identifiers.
        </div>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>Alert Queue</h1>
          <div style={{ color: "#64748b" }}>
            Prioritize outreach, review symptoms, and document follow-up.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <SummaryCard
            label="Urgent"
            value={urgentAlerts.length}
            valueColor="#dc2626"
            background="#fef2f2"
            border="#fecaca"
          />
          <SummaryCard
            label="Needs Attention"
            value={attentionAlerts.length}
            valueColor="#d97706"
            background="#fffbeb"
            border="#fde68a"
          />
          <SummaryCard
            label="Attempted"
            value={attemptedAlerts.length}
            valueColor="#2563eb"
            background="#eff6ff"
            border="#bfdbfe"
          />
          <SummaryCard
            label="Resolved"
            value={resolvedAlerts.length}
            valueColor="#16a34a"
            background="#f0fdf4"
            border="#bbf7d0"
          />
        </div>

        <SectionTitle
          title="Urgent Alerts"
          subtitle="Same-day follow-up recommended"
        />

        {urgentAlerts.length === 0 ? (
          <EmptyState text="No urgent alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
            {urgentAlerts.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                outreachStatus={meta[patient.id]?.outreachStatus || "new"}
                notes={meta[patient.id]?.notes || ""}
                onUpdateMeta={updateMeta}
              />
            ))}
          </div>
        )}

        <SectionTitle
          title="Needs Attention"
          subtitle="Follow-up within 24 hours"
        />

        {attentionAlerts.length === 0 ? (
          <EmptyState text="No attention alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
            {attentionAlerts.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                outreachStatus={meta[patient.id]?.outreachStatus || "new"}
                notes={meta[patient.id]?.notes || ""}
                onUpdateMeta={updateMeta}
              />
            ))}
          </div>
        )}

        <SectionTitle
          title="Resolved / Completed"
          subtitle="Handled alerts"
        />

        {resolvedAlerts.length === 0 ? (
          <EmptyState text="No resolved alerts yet." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {resolvedAlerts.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                outreachStatus={meta[patient.id]?.outreachStatus || "new"}
                notes={meta[patient.id]?.notes || ""}
                onUpdateMeta={updateMeta}
              />
            ))}
          </div>
        )}

        <PrototypeFooter />
      </div>
    </main>
  );
}