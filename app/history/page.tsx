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

function loadDashboardMeta(): DashboardMeta {
  try {
    const raw = localStorage.getItem("dashboard_meta");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDashboardMeta(meta: DashboardMeta) {
  localStorage.setItem("dashboard_meta", JSON.stringify(meta));
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

function HistoryCard({
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

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "white",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
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
          <div style={{ fontSize: 24, fontWeight: 800 }}>{patient.study_code}</div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Post-procedure • Week {patient.weeks_since_ablation}
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Procedure date: {patient.ablation_date}
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Submitted {timeAgo(patient.created_at)}
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
          Submission Summary
        </div>
        <div style={{ color: "#334155", lineHeight: 1.5 }}>{patient.summary}</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
          Workflow Status
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
            onClick={() => onUpdateMeta(patient.id, { outreachStatus: "attempted" })}
          />
          <ActionButton
            label="Reached"
            active={outreachStatus === "called"}
            onClick={() => onUpdateMeta(patient.id, { outreachStatus: "called" })}
          />
          <ActionButton
            label="Resolved"
            active={outreachStatus === "resolved"}
            onClick={() => onUpdateMeta(patient.id, { outreachStatus: "resolved" })}
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
          placeholder="Document completed outreach and follow-up..."
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
  );
}

export default function HistoryPage() {
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
  }, [router]);

  const resolvedPatients = useMemo(() => {
    return patients.filter((p) => (meta[p.id]?.outreachStatus || "new") === "resolved");
  }, [patients, meta]);

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
              History
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827" }}>
              Check-In
            </a>
            <a href="/dashboard" style={{ textDecoration: "none", color: "#111827", fontWeight: 700 }}>
              Dashboard
            </a>
            <a
              href="/history"
              style={{
                textDecoration: "none",
                color: "#111827",
                fontWeight: 700,
              }}
            >
              History
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

        <SectionTitle
          title="Resolved / Completed"
          subtitle="Archived follow-up items"
        />

        {resolvedPatients.length === 0 ? (
          <EmptyState text="No resolved alerts yet." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {resolvedPatients.map((patient) => (
              <HistoryCard
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