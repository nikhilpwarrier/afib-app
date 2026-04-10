"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
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
  would_have_gone_to_ed: boolean;
  outreach_status: OutreachStatus | null;
  outreach_notes: string | null;
  first_outreach_at: string | null;
  resolved_at: string | null;
  status: Status;
  summary: string;
  created_at: string;
};

const ADMIN_SESSION_KEY = "atria_admin_auth";

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

function ActionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: active ? "1px solid #111827" : "1px solid #d4d4d4",
        background: active ? "#111827" : "white",
        color: active ? "white" : "#111827",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#64748b", marginTop: 3, fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px", color: "#64748b", marginBottom: 30, background: "white", fontSize: 14 }}>
      {text}
    </div>
  );
}

function PrototypeFooter() {
  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
      Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter patient names, MRNs, dates of birth, or other direct identifiers.
    </div>
  );
}

function HistoryCard({ patient, onRefresh }: { patient: PatientRecord; onRefresh: () => void }) {
  const [localNotes, setLocalNotes] = useState(() => patient.outreach_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const outreachStatus = patient.outreach_status || "new";

  async function updateOutreachStatus(nextStatus: OutreachStatus) {
    setSavingStatus(true);

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = { outreach_status: nextStatus };

    // Write first_outreach_at when moving to attempted/called for the first time
    if (
      (nextStatus === "attempted" || nextStatus === "called") &&
      !patient.first_outreach_at
    ) {
      updates.first_outreach_at = now;
    }

    // Write resolved_at when marking resolved
    if (nextStatus === "resolved" && !patient.resolved_at) {
      updates.resolved_at = now;
    }

    // Clear resolved_at if moving back from resolved
    if (nextStatus !== "resolved" && patient.resolved_at) {
      updates.resolved_at = null;
    }

    const { error } = await supabase
      .from("checkins")
      .update(updates)
      .eq("id", patient.id);

    setSavingStatus(false);
    if (error) { console.error(error); alert("Error saving outreach status"); return; }
    onRefresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    const { error } = await supabase.from("checkins").update({ outreach_notes: localNotes }).eq("id", patient.id);
    setSavingNotes(false);
    if (error) { console.error(error); alert("Error saving note"); return; }
    onRefresh();
  }

  return (
    <div style={{ display: "flex", borderRadius: 16, overflow: "hidden", background: "white", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 4, flexShrink: 0, background: severityColor(patient.status) }} />
      <div style={{ padding: 18, flex: 1, minWidth: 0 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {patient.study_code}
              {patient.would_have_gone_to_ed && (
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700 }}>ER AVOIDED</span>
              )}
              {patient.clinic_contact_me && (
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "#fde68a", color: "#92400e", fontSize: 10, fontWeight: 700 }}>CALLBACK</span>
              )}
            </div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 13 }}>
              Post-procedure · Week {patient.weeks_since_ablation} · {patient.ablation_date}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{ background: severityBg(patient.status), border: `1px solid ${severityBorder(patient.status)}`, color: severityColor(patient.status), borderRadius: 999, padding: "5px 12px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
              {severityLabel(patient.status)}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
              {timeAgo(patient.created_at)}
            </div>
          </div>
        </div>

        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Submission Summary</div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{patient.summary}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>Workflow Status</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ActionButton label="New" active={outreachStatus === "new"} onClick={() => updateOutreachStatus("new")} />
            <ActionButton label="Attempted" active={outreachStatus === "attempted"} onClick={() => updateOutreachStatus("attempted")} />
            <ActionButton label="Reached" active={outreachStatus === "called"} onClick={() => updateOutreachStatus("called")} />
            <ActionButton label="Resolved" active={outreachStatus === "resolved"} onClick={() => updateOutreachStatus("resolved")} />
          </div>
          {savingStatus && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Saving...</div>}
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>Care Team Notes</div>
          <textarea
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Document completed outreach and follow-up..."
            style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 10, border: "1px solid #d4d4d4", resize: "vertical", fontFamily: "Arial, sans-serif", fontSize: 13, boxSizing: "border-box" }}
          />
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={saveNotes} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#111827", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {savingNotes ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 12 }}>
          Workflow: <strong style={{ color: "#64748b" }}>{outreachLabel(outreachStatus)}</strong>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [patients, setPatients] = useState<PatientRecord[]>([]);

  const loadPatientsFromDB = useCallback(async () => {
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return (data || []) as PatientRecord[];
  }, []);

  const refresh = useCallback(async () => {
    const data = await loadPatientsFromDB();
    setPatients(data);
  }, [loadPatientsFromDB]);

  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null;
    if (existing !== "true") { router.replace("/admin-login"); return; }
    setAuthorized(true);
    refresh();
  }, [router, refresh]);

  function handleLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    router.push("/admin-login");
  }

  if (!authorized) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, color: "#111827", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 14, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Logo size={140} />
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>History</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Check-In</a>
            <a href="/dashboard" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Dashboard</a>
            <a href="/history" style={{ textDecoration: "none", color: "#111827", fontWeight: 700, fontSize: 14 }}>History</a>
            <a href="/performance" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Performance</a>
            <button type="button" onClick={refresh} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Refresh</button>
            <button type="button" onClick={handleLogout} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Logout</button>
          </div>
        </div>

        <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
          Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter direct patient identifiers.
        </div>

        <SectionTitle title="Check-In History" subtitle="All submitted check-ins" />

        {patients.length === 0 ? (
          <EmptyState text="No check-ins yet." />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {patients.map((patient) => (
              <HistoryCard key={patient.id} patient={patient} onRefresh={refresh} />
            ))}
          </div>
        )}

        <PrototypeFooter />
      </div>
    </main>
  );
}