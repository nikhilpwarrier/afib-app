"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type Status = "urgent" | "attention" | "stable";
type OutreachStatus = "attempted" | "called" | "resolved";
type OutcomeTag = "reassured" | "meds_adjusted" | "visit_scheduled" | "sent_to_ed" | "no_action";

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
  precipitating_factor: "none" | "exertion" | "stress" | "missed_meds" | "alcohol" | "unknown";
  clinic_contact_me: boolean;
  would_have_gone_to_ed: boolean;
  outreach_status: OutreachStatus | null;
  outreach_notes: string | null;
  outcome_tag: OutcomeTag | null;
  first_outreach_at: string | null;
  resolved_at: string | null;
  status: Status;
  summary: string;
  created_at: string;
};

type HistoryCheckin = {
  id: string;
  status: Status;
  summary: string;
  would_have_gone_to_ed: boolean;
  weeks_since_ablation: number;
  created_at: string;
  outreach_status: OutreachStatus | null;
};

const ADMIN_SESSION_KEY = "atria_admin_auth";

// ── Helpers ───────────────────────────────────────────────────────────

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

function outcomeLabel(tag: OutcomeTag): string {
  const labels: Record<OutcomeTag, string> = {
    reassured: "Reassured",
    meds_adjusted: "Meds adjusted",
    visit_scheduled: "Visit scheduled",
    sent_to_ed: "Sent to ED",
    no_action: "No action needed",
  };
  return labels[tag];
}

function timeAgo(value: string) {
  const ts = new Date(value).getTime();
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function agingColor(createdAt: string, status: Status): string {
  const mins = minutesBetween(createdAt, new Date().toISOString());
  if (status === "urgent") {
    if (mins < 60) return "#16a34a";
    if (mins < 240) return "#d97706";
    return "#dc2626";
  }
  if (mins < 240) return "#16a34a";
  if (mins < 1440) return "#d97706";
  return "#dc2626";
}

// Fixed - no duplicate severe palpitations
function buildAlertReason(patient: PatientRecord): string {
  if (patient.status === "urgent") {
    if (patient.chest_pain) return "Chest pain reported";
    if (patient.shortness_of_breath === "rest") return "Shortness of breath at rest";
    if (patient.palpitations === "severe") {
      if (patient.duration === "over_30") return "Severe palpitations > 30 min";
      return "Severe palpitations";
    }
    return "High-risk symptoms";
  }
  if (patient.status === "attention") {
    if (patient.clinic_contact_me) return "Requested clinic contact";
    if (patient.would_have_gone_to_ed) return "Would have gone to ER without app";
    if (patient.shortness_of_breath === "activity") return "Shortness of breath with activity";
    if (patient.palpitations === "moderate") return "Moderate palpitations";
    if (patient.palpitations === "severe") return "Severe palpitations";
    if (patient.duration === "5_30") return "Symptoms 5-30 min";
    if (patient.duration === "over_30") return "Symptoms > 30 min";
    return "Needs follow-up";
  }
  return "No urgent concerns";
}

function buildFlagDetail(patient: PatientRecord): string {
  const parts: string[] = [];

  const titleAlreadyExplainsPalpitations =
    patient.palpitations === "moderate" ||
    patient.palpitations === "severe" ||
    patient.duration === "5_30" ||
    patient.duration === "over_30";

  if (!titleAlreadyExplainsPalpitations && patient.palpitations !== "none") {
    const dur =
      patient.duration === "under_5" ? "< 5 min" :
      patient.duration === "5_30" ? "5-30 min" :
      patient.duration === "over_30" ? "> 30 min" : "";
    parts.push(dur ? `${patient.palpitations} palpitations · ${dur}` : `${patient.palpitations} palpitations`);
  }

  if (patient.chest_pain) parts.push("chest pain");
  if (patient.shortness_of_breath === "activity") parts.push("SOB with activity");
  if (patient.shortness_of_breath === "rest") parts.push("SOB at rest");

  if (patient.precipitating_factor !== "none") {
    const label =
      patient.precipitating_factor === "missed_meds"
        ? "missed meds"
        : patient.precipitating_factor === "alcohol"
          ? "alcohol"
          : patient.precipitating_factor;
    parts.push(label);
  }

  return parts.join(" · ");
}

function sortPatients(patients: PatientRecord[]) {
  const severityRank: Record<Status, number> = { urgent: 0, attention: 1, stable: 2 };
  const outreachRank: Record<OutreachStatus, number> = { attempted: 0, called: 1, resolved: 2 };

  return [...patients].sort((a, b) => {
    if (a.status !== b.status) return severityRank[a.status] - severityRank[b.status];

    const aO = a.outreach_status || "attempted";
    const bO = b.outreach_status || "attempted";
    if (aO !== bO) return outreachRank[aO] - outreachRank[bO];

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// ── Patient History Panel ─────────────────────────────────────────────

function PatientHistoryPanel({ studyCode, currentId }: { studyCode: string; currentId: string }) {
  const [history, setHistory] = useState<HistoryCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("checkins")
        .select("id, status, summary, would_have_gone_to_ed, weeks_since_ablation, created_at, outreach_status")
        .eq("study_code", studyCode)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data || []) as HistoryCheckin[]);
      setLoading(false);
    }
    load();
  }, [studyCode]);

  const statusDot: Record<Status, string> = {
    urgent: "#dc2626",
    attention: "#d97706",
    stable: "#16a34a",
  };

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
        Check-In History · {studyCode}
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Loading...</div>
      ) : history.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9ca3af" }}>No prior check-ins.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: 8, background: h.id === currentId ? "#f0f9ff" : "#f8fafc", border: h.id === currentId ? "1px solid #bae6fd" : "1px solid #f1f5f9" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot[h.status], flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: severityColor(h.status) }}>
                    {severityLabel(h.status)}
                    {h.id === currentId && <span style={{ marginLeft: 6, fontSize: 10, color: "#0369a1", fontWeight: 600 }}>current</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>Wk {h.weeks_since_ablation} · {timeAgo(h.created_at)}</div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{h.summary}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {h.would_have_gone_to_ed && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", padding: "1px 6px", borderRadius: 999 }}>ER AVOIDED</span>
                  )}
                  {h.outreach_status && h.outreach_status !== "attempted" && (
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      {h.outreach_status === "called" ? "Reached" : "Resolved"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function OutcomeButton({ tag, active, onClick }: { tag: OutcomeTag; active: boolean; onClick: () => void }) {
  const colors: Record<OutcomeTag, { bg: string; border: string; color: string }> = {
    reassured: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
    meds_adjusted: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
    visit_scheduled: { bg: "#f5f3ff", border: "#ddd6fe", color: "#7c3aed" },
    sent_to_ed: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
    no_action: { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" },
  };
  const c = colors[tag];
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 10px", borderRadius: 8,
      border: active ? `2px solid ${c.color}` : "1px solid #e2e8f0",
      boxShadow: active ? `0 0 0 1px ${c.color}20` : "none",
      background: active ? c.bg : "white",
      color: active ? c.color : "#64748b",
      cursor: "pointer", fontSize: 11.5, fontWeight: active ? 700 : 500,
    }}>
      {outcomeLabel(tag)}
    </button>
  );
}

function SummaryCard({ label, value, valueColor, background, border }: { label: string; value: number; valueColor: string; background: string; border: string }) {
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

// ── Patient Card ──────────────────────────────────────────────────────

function PatientCard({ patient, onRefresh }: { patient: PatientRecord; onRefresh: () => void }) {
  const [localNotes, setLocalNotes] = useState(() => patient.outreach_notes || "");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const reason = buildAlertReason(patient);
  const flagDetail = buildFlagDetail(patient);
  const outreachStatus = patient.outreach_status || "attempted";
  const isResolved = outreachStatus === "resolved";
  const ageColor = agingColor(patient.created_at, patient.status);

  async function setStatus(nextStatus: OutreachStatus) {
    setSaving(true);
    const now = new Date().toISOString();
    const updates: Record<string, string | null> = { outreach_status: nextStatus };
    if (nextStatus === "called" && !patient.first_outreach_at) {
      updates.first_outreach_at = now;
    }
    if (nextStatus !== "resolved") {
      updates.resolved_at = null;
    }
    if (nextStatus === "attempted") {
      updates.outcome_tag = null;
    }
    const { error } = await supabase.from("checkins").update(updates).eq("id", patient.id);
    setSaving(false);
    if (error) { console.error(error); alert("Error saving status"); return; }
    onRefresh();
  }

  // Auto-saves note + sets resolved_at in one operation
  async function resolveWithNote() {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("checkins")
      .update({
        outreach_status: "resolved",
        resolved_at: now,
        outreach_notes: localNotes,
      })
      .eq("id", patient.id);
    setSaving(false);
    if (error) { console.error(error); alert("Error resolving"); return; }
    onRefresh();
  }

  async function setOutcome(tag: OutcomeTag) {
    const next = patient.outcome_tag === tag ? null : tag;
    await supabase.from("checkins").update({ outcome_tag: next }).eq("id", patient.id);
    onRefresh();
  }

  async function saveNotes() {
    setSaving(true);
    await supabase.from("checkins").update({ outreach_notes: localNotes }).eq("id", patient.id);
    setSaving(false);
    onRefresh();
  }

  return (
    <div style={{ display: "flex", borderRadius: 16, overflow: "hidden", background: "white", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", opacity: isResolved ? 0.75 : 1 }}>
      <div style={{ width: 4, flexShrink: 0, background: severityColor(patient.status) }} />
      <div style={{ padding: 14, flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowHistory(h => !h)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 20, fontWeight: 800, color: "#111827" }}>
                {patient.study_code}
              </button>
              <button type="button" onClick={() => setShowHistory(h => !h)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", cursor: "pointer", fontWeight: 500 }}>
                {showHistory ? "Hide history" : "View history"}
              </button>
              {patient.clinic_contact_me && <span style={{ padding: "3px 8px", borderRadius: 999, background: "#fde68a", color: "#92400e", fontSize: 10, fontWeight: 700 }}>CALLBACK</span>}
              {patient.would_have_gone_to_ed && <span style={{ padding: "3px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700 }}>ER AVOIDED</span>}
            </div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 13 }}>
              Post-procedure · Week {patient.weeks_since_ablation} · {patient.ablation_date}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <div style={{ background: severityBg(patient.status), border: `1px solid ${severityBorder(patient.status)}`, color: severityColor(patient.status), borderRadius: 999, padding: "5px 12px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
              {severityLabel(patient.status)}
            </div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: isResolved ? "#9ca3af" : ageColor, fontWeight: 700 }}>
              {isResolved && patient.resolved_at
                ? `Resolved ${timeAgo(patient.resolved_at)}`
                : `Waiting ${timeAgo(patient.created_at).replace(" ago", "")}`}
            </div>
            {patient.first_outreach_at && !isResolved && (
              <div style={{ fontSize: 11, fontWeight: 700, color: minutesBetween(patient.created_at, patient.first_outreach_at) < 60 ? "#16a34a" : minutesBetween(patient.created_at, patient.first_outreach_at) < 240 ? "#d97706" : "#dc2626" }}>
                {formatMinutes(minutesBetween(patient.created_at, patient.first_outreach_at))} to contact
              </div>
            )}
          </div>
        </div>

        {/* Flag reason — prominent */}
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{reason}</div>
          {flagDetail && <div style={{ fontSize: 12, color: "#64748b" }}>{flagDetail}</div>}
          <div style={{ fontSize: 12.5, fontWeight: 600, color: severityColor(patient.status), marginTop: 4, letterSpacing: "0.2px" }}>
            {patient.status === "urgent" && "Same-day follow-up recommended"}
            {patient.status === "attention" && "Follow-up within 24 hours"}
          </div>
        </div>

        {/* Timestamps */}
        {(patient.first_outreach_at || patient.resolved_at) && (
          <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
            {patient.first_outreach_at && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                First outreach: <strong style={{ color: "#111827", fontFamily: "monospace" }}>{new Date(patient.first_outreach_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                <span style={{ marginLeft: 6, color: "#16a34a", fontWeight: 600 }}>({formatMinutes(minutesBetween(patient.created_at, patient.first_outreach_at))} response)</span>
              </div>
            )}
            {patient.resolved_at && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Resolved: <strong style={{ color: "#111827", fontFamily: "monospace" }}>{new Date(patient.resolved_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                <span style={{ marginLeft: 6, color: "#64748b" }}>({formatMinutes(minutesBetween(patient.created_at, patient.resolved_at))} total)</span>
              </div>
            )}
          </div>
        )}

        {/* ── Active workflow ── */}
        {!isResolved && (
          <>
            {/* Step 1 — Contact Status */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>Contact Status</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setStatus("attempted")} style={{
  padding: "8px 16px",
  borderRadius: 999,
  border: outreachStatus === "attempted" ? "1px solid #d97706" : "1px solid #d4d4d4",
  background: outreachStatus === "attempted" ? "#fffbeb" : "white",
  color: outreachStatus === "attempted" ? "#b45309" : "#111827",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
}}>
                  Attempted
                </button>
                <button type="button" onClick={() => setStatus("called")} style={{ padding: "8px 16px", borderRadius: 999, border: outreachStatus === "called" ? "1px solid #16a34a" : "1px solid #d4d4d4", background: outreachStatus === "called" ? "#16a34a" : "white", color: outreachStatus === "called" ? "white" : "#111827", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Reached
                </button>
              </div>
              {saving && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Saving...</div>}
            </div>

            {/* Step 2 — Notes (always visible) */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>Care Team Notes</div>
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Document callback attempt, recommendations, follow-up plan..."
                style={{ width: "100%", minHeight: 72, padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", resize: "vertical", fontFamily: "Arial, sans-serif", fontSize: 13, boxSizing: "border-box" }}
              />
              <button type="button" onClick={saveNotes} style={{ marginTop: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#111827", color: "white", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                {saving ? "Saving..." : "Save Note"}
              </button>
            </div>

            {/* Step 3 — Disposition (only after reached) */}
            {outreachStatus === "called" && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>Disposition</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["reassured", "meds_adjusted", "visit_scheduled", "sent_to_ed", "no_action"] as OutcomeTag[]).map((tag) => (
                    <OutcomeButton key={tag} tag={tag} active={patient.outcome_tag === tag} onClick={() => setOutcome(tag)} />
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Resolve & Save (only after reached + disposition) */}
            {outreachStatus === "called" && patient.outcome_tag && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>Ready to close this alert</div>
                <button type="button" onClick={resolveWithNote} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#16a34a", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                  {saving ? "Saving..." : "Resolve & Save"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Resolved state ── */}
        {isResolved && (
          <div style={{ marginBottom: 8 }}>
            {patient.outcome_tag && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                Disposition: <strong style={{ color: "#111827" }}>{outcomeLabel(patient.outcome_tag)}</strong>
              </div>
            )}
            {patient.outreach_notes && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {patient.outreach_notes}
              </div>
            )}
            <button type="button" onClick={() => setStatus("attempted")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              Reopen
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && <PatientHistoryPanel studyCode={patient.study_code} currentId={patient.id} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

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

  const openAlerts = sortedPatients.filter((p) => (p.outreach_status || "attempted") !== "resolved" && p.status !== "stable");
  const urgentAlerts = openAlerts.filter((p) => p.status === "urgent");
  const attentionAlerts = openAlerts.filter((p) => p.status === "attention");

  const resolvedToday = sortedPatients.filter((p) => {
    if ((p.outreach_status || "attempted") !== "resolved" || !p.resolved_at) return false;
    return Date.now() - new Date(p.resolved_at).getTime() < 86400000;
  });

  const stablePatients = sortedPatients.filter((p) => p.status === "stable");
  const erAvoidanceCount = sortedPatients.filter((p) => p.would_have_gone_to_ed).length;
  const unresolvedCount = openAlerts.length;

  function handleLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    router.push("/admin-login");
  }

  if (!authorized) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, color: "#111827", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* Nav */}
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

        {/* Banner */}
        <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
          Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter direct patient identifiers.
        </div>

        {/* Page header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 28, marginBottom: 6, fontWeight: 800, letterSpacing: "-0.5px" }}>Alert Queue</h1>
          <div style={{ color: "#64748b", fontSize: 13 }}>Prioritize outreach, review symptoms, and document follow-up.</div>
        </div>

        {/* Summary tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
          <SummaryCard label="Urgent" value={urgentAlerts.length} valueColor="#dc2626" background="#fef2f2" border="#fecaca" />
          <SummaryCard label="Needs Attention" value={attentionAlerts.length} valueColor="#d97706" background="#fffbeb" border="#fde68a" />
          <SummaryCard label="Unresolved" value={unresolvedCount} valueColor={unresolvedCount > 0 ? "#d97706" : "#16a34a"} background={unresolvedCount > 0 ? "#fffbeb" : "#f0fdf4"} border={unresolvedCount > 0 ? "#fde68a" : "#bbf7d0"} />
          <SummaryCard label="Resolved Today" value={resolvedToday.length} valueColor="#16a34a" background="#f0fdf4" border="#bbf7d0" />
          <SummaryCard label="ER Avoided" value={erAvoidanceCount} valueColor="#1d4ed8" background="#eff6ff" border="#bfdbfe" />
        </div>

        {/* Urgent */}
        <SectionTitle title="Urgent Alerts" subtitle="Same-day follow-up recommended" />
        {urgentAlerts.length === 0 ? (
          <EmptyState text="No urgent alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {urgentAlerts.map((p) => <PatientCard key={p.id} patient={p} onRefresh={refresh} />)}
          </div>
        )}

        {/* Attention */}
        <SectionTitle title="Needs Attention" subtitle="Follow-up within 24 hours" />
        {attentionAlerts.length === 0 ? (
          <EmptyState text="No attention alerts right now." />
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {attentionAlerts.map((p) => <PatientCard key={p.id} patient={p} onRefresh={refresh} />)}
          </div>
        )}

        {/* Recently Resolved */}
        <SectionTitle title="Recently Resolved" subtitle="Closed alerts in the last 24 hours" />
        {resolvedToday.length === 0 ? (
          <EmptyState text="No alerts resolved today." />
        ) : (
          <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
            {resolvedToday.map((p) => <PatientCard key={p.id} patient={p} onRefresh={refresh} />)}
          </div>
        )}

        {/* Stable */}
        <SectionTitle title="Stable Check-Ins" subtitle="Confirms patient engagement even when no follow-up is needed" />
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", marginBottom: 30, overflow: "hidden" }}>
          <button type="button" onClick={() => setShowStable((prev) => !prev)} style={{ width: "100%", textAlign: "left", padding: "13px 16px", border: "none", background: "#f8fafc", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#111827" }}>
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
                  {stablePatients.map((p) => <StableRow key={p.id} patient={p} />)}
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