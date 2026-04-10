"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function buildAlertReason(patient: PatientRecord) {
  if (patient.status === "urgent") {
    if (patient.chest_pain) return "Chest pain reported";
    if (patient.shortness_of_breath === "rest") return "Shortness of breath at rest";
    if (patient.palpitations === "severe" && patient.duration === "over_30") return "Severe palpitations > 30 minutes";
    return "High-risk symptoms";
  }
  if (patient.status === "attention") {
    if (patient.clinic_contact_me) return "Requested clinic contact";
    if (patient.would_have_gone_to_ed) return "Would have gone to ER without app";
    if (patient.shortness_of_breath === "activity") return "Shortness of breath with activity";
    if (patient.palpitations === "moderate") return "Moderate palpitations";
    if (patient.palpitations === "severe") return "Severe palpitations";
    if (patient.duration === "5_30") return "Symptoms 5-30 minutes";
    if (patient.duration === "over_30") return "Symptoms > 30 minutes";
    return "Needs follow-up";
  }
  return "No urgent concerns";
}

function sortPatients(patients: PatientRecord[]) {
  const severityRank: Record<Status, number> = { urgent: 0, attention: 1, stable: 2 };
  const outreachRank: Record<OutreachStatus, number> = { new: 0, attempted: 1, called: 2, resolved: 3 };
  return [...patients].sort((a, b) => {
    const aOutreach = a.outreach_status || "new";
    const bOutreach = b.outreach_status || "new";
    if (aOutreach !== bOutreach) return outreachRank[aOutreach] - outreachRank[bOutreach];
    if (a.status !== b.status) return severityRank[a.status] - severityRank[b.status];
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
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

function SummaryCard({ label, value, valueColor, background, border }: {
  label: string; value: number; valueColor: string; background: string; border: string;
}) {
  return (
    <div style={{ border: `1px solid ${border}`, background, borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: valueColor }}>{value}</div>
    </div>
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

function StableRow({ patient }: { patient: PatientRecord }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.4fr 1fr", gap: 12, padding: "11px 14px", borderBottom: "1px solid #e5e7eb", alignItems: "center", fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{patient.study_code}</div>
      <div style={{ color: "#64748b" }}>Week {patient.weeks_since_ablation}</div>
      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>{new Date(patient.created_at).toLocaleString()}</div>
      <div style={{ color: "#16a34a", fontWeight: 700 }}>Stable</div>
    </div>
  );
}

function PatientCard({ patient, onRefresh }: { patient: PatientRecord; onRefresh: () => void }) {
  const [localNotes, setLocalNotes] = useState(() => patient.outreach_notes || "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const reason = buildAlertReason(patient);
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
            <div style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {patient.study_code}
              {outreachStatus === "new" && (
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontSize: 10, fontWeight: 700 }}>NEW</span>
              )}
              {patient.clinic_contact_me && (
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "#fde68a", color: "#92400e", fontSize: 10, fontWeight: 700 }}>CALLBACK</span>
              )}
              {patient.would_have_gone_to_ed && (
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700 }}>ER AVOIDED</span>
              )}
            </div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 13 }}>
              Post-procedure · Week {patient.weeks_since_ablation} · {patient.ablation_date}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{ background: severityBg(patient.status), border: `1px solid ${severityBorder(patient.status)}`, color: severityColor(patient.status), borderRadius: 999, padding: "6px 12px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
              {severityLabel(patient.status)}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
              {timeAgo(patient.created_at)}
            </div>
          </div>
        </div>

        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 3 }}>{reason}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: severityColor(patient.status), marginBottom: 4 }}>
            {patient.status === "urgent" && "-> Same-day follow-up recommended"}
            {patient.status === "attention" && "-> Follow-up within 24 hours"}
            {patient.status === "stable" && "-> No action needed"}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{patient.summary}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>Outreach Status</div>
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
            placeholder="Document callback attempt, recommendations, follow-up plan..."
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

export default function DashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [showStable, setShowStable] = useState(false);

  const loadPatientsFromDB = useCallback(async () => {
    const { data, error } = await supabase.from("checkins").select("*").order("created_at", { ascending: false });
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
    const interval = setInterval(() => { refresh(); }, 5000);
    const handleFocus = () => refresh();
    const handleVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, refresh]);

  const sortedPatients = useMemo(() => sortPatients(patients), [patients]);
  const openAlerts = sortedPatients.filter((p) => (p.outreach_status || "new") !== "resolved" && p.status !== "stable");
  const urgentAlerts = openAlerts.filter((p) => p.status === "urgent");
  const attentionAlerts = openAlerts.filter((p) => p.status === "attention");
  const attemptedAlerts = sortedPatients.filter((p) => (p.outreach_status || "new") === "attempted");
  const resolvedAlerts = sortedPatients.filter((p) => (p.outreach_status || "new") === "resolved");
  const stablePatients = sortedPatients.filter((p) => p.status === "stable");
  const erAvoidanceCount = sortedPatients.filter((p) => p.would_have_gone_to_ed).length;

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
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Admin Dashboard</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Check-In</a>
            <a href="/dashboard" style={{ textDecoration: "none", color: "#111827", fontWeight: 700, fontSize: 14 }}>Dashboard</a>
            <a href="/history" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>History</a>
            <a href="/performance" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Performance</a>
            <button type="button" onClick={refresh} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Refresh</button>
            <button type="button" onClick={handleLogout} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Logout</button>
          </div>
        </div>

        <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
          Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter direct patient identifiers.
        </div>

        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 28, marginBottom: 6, fontWeight: 800, letterSpacing: "-0.5px" }}>Alert Queue</h1>
          <div style={{ color: "#64748b", fontSize: 13 }}>Prioritize outreach, review symptoms, and document follow-up.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
          <SummaryCard label="Urgent" value={urgentAlerts.length} valueColor="#dc2626" background="#fef2f2" border="#fecaca" />
          <SummaryCard label="Needs Attention" value={attentionAlerts.length} valueColor="#d97706" background="#fffbeb" border="#fde68a" />
          <SummaryCard label="Attempted" value={attemptedAlerts.length} valueColor="#2563eb" background="#eff6ff" border="#bfdbfe" />
          <SummaryCard label="Resolved" value={resolvedAlerts.length} valueColor="#16a34a" background="#f0fdf4" border="#bbf7d0" />
          <SummaryCard label="ER Avoided" value={erAvoidanceCount} valueColor="#1d4ed8" background="#eff6ff" border="#bfdbfe" />
        </div>

        <SectionTitle title="Urgent Alerts" subtitle="Same-day follow-up recommended" />
        {urgentAlerts.length === 0 ? (
          <EmptyState text="No urgent alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {urgentAlerts.map((patient) => <PatientCard key={patient.id} patient={patient} onRefresh={refresh} />)}
          </div>
        )}

        <SectionTitle title="Needs Attention" subtitle="Follow-up within 24 hours" />
        {attentionAlerts.length === 0 ? (
          <EmptyState text="No attention alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {attentionAlerts.map((patient) => <PatientCard key={patient.id} patient={patient} onRefresh={refresh} />)}
          </div>
        )}

        <SectionTitle title="Stable Check-Ins" subtitle="Confirms patient engagement even when no follow-up is needed" />
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", marginBottom: 30, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setShowStable((prev) => !prev)}
            style={{ width: "100%", textAlign: "left", padding: "13px 16px", border: "none", background: "#f8fafc", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111827" }}
          >
            {showStable ? "Hide" : "Show"} Stable Check-Ins ({stablePatients.length})
          </button>
          {showStable && (
            <>
              {stablePatients.length === 0 ? (
                <div style={{ padding: 16, color: "#64748b", fontSize: 13 }}>No stable check-ins yet.</div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.4fr 1fr", gap: 12, padding: "10px 14px", borderBottom: "1px solid #e5e7eb", background: "#fafafa", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <div>Study Code</div><div>Week</div><div>Timestamp</div><div>Status</div>
                  </div>
                  {stablePatients.map((patient) => <StableRow key={patient.id} patient={patient} />)}
                </div>
              )}
            </>
          )}
        </div>

        <PrototypeFooter />
      </div>
    </main>
  );
}