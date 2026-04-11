"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type Status = "urgent" | "attention" | "stable";
type OutreachStatus = "attempted" | "called" | "resolved";


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
  first_outreach_at: string | null;
  resolved_at: string | null;
  status: Status;
  summary: string;
  created_at: string;
};

const ADMIN_SESSION_KEY = "atria_admin_auth";

// ── Pure helpers ──────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "--";
  return `${Math.round((num / denom) * 100)}%`;
}

function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function outreachDisplayLabel(status: OutreachStatus | null): string {
  if (status === "called") return "Reached";
  if (status === "resolved") return "Resolved";
  if (status === "attempted") return "Attempted";
  return "--";
}


// ── UI primitives ─────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  valueColor = "#111827",
  background = "white",
  border = "#e5e7eb",
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
  background?: string;
  border?: string;
}) {
  return (
    <div style={{ border: `1px solid ${border}`, background, borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: valueColor, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14, marginTop: 32 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 3 }}>{subtitle}</div>}
    </div>
  );
}

function Table({
  headers,
  rows,
  emptyText = "No data yet.",
}: {
  headers: string[];
  rows: (string | number)[][];
  emptyText?: string;
}) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white", marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${headers.length}, 1fr)`, background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "10px 14px", gap: 8 }}>
        {headers.map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "16px 14px", fontSize: 13, color: "#9ca3af" }}>{emptyText}</div>
      ) : (
        rows.map((row, ri) => (
          <div
            key={ri}
            style={{ display: "grid", gridTemplateColumns: `repeat(${headers.length}, 1fr)`, padding: "11px 14px", gap: 8, borderBottom: ri < rows.length - 1 ? "1px solid #f1f5f9" : "none", alignItems: "center" }}
          >
            {row.map((cell, ci) => (
              <div key={ci} style={{ fontSize: 13, color: ci === 0 ? "#111827" : "#64748b", fontWeight: ci === 0 ? 700 : 400 }}>
                {cell}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function WeekBar({ week, count, max, color }: { week: number; count: number; max: number; color: string }) {
  const pctWidth = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: "#64748b", width: 52, textAlign: "right", flexShrink: 0 }}>Wk {week}</div>
      <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pctWidth}%`, background: color, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", width: 24, flexShrink: 0 }}>{count}</div>
    </div>
  );
}

function PrototypeFooter() {
  return (
    <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
      Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter patient names, MRNs, dates of birth, or other direct identifiers.
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function PerformancePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return (data || []) as PatientRecord[];
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadData();
    setRecords(data);
    setLoading(false);
  }, [loadData]);

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

  // ── Computed metrics ───────────────────────────────────────────────

  const totalCheckins = records.length;
  const patientCodes = [...new Set(records.map((r) => r.study_code))];
  const totalPatients = patientCodes.length;

  const checkinsPerPatient = patientCodes.map((code) =>
    records.filter((r) => r.study_code === code).length
  );
  const medianCheckins = median(checkinsPerPatient);

  const noSymptomCheckins = records.filter((r) => r.no_symptoms).length;
  const symptomCheckins = totalCheckins - noSymptomCheckins;

  const yellowFlags = records.filter((r) => r.status === "attention").length;
  const redFlags = records.filter((r) => r.status === "urgent").length;
  const totalFlags = yellowFlags + redFlags;

  const erAvoidanceTotal = records.filter((r) => r.would_have_gone_to_ed).length;
  const erAvoidancePatients = new Set(
    records.filter((r) => r.would_have_gone_to_ed).map((r) => r.study_code)
  ).size;

  const callbackRequests = records.filter((r) => r.clinic_contact_me).length;

  const flaggedRecords = records.filter((r) => r.status !== "stable");
  const contacted = flaggedRecords.filter((r) =>
    r.outreach_status === "called" || r.outreach_status === "resolved"
  ).length;
  const resolved = flaggedRecords.filter((r) => r.outreach_status === "resolved").length;
  const unresolved = flaggedRecords.filter(
  (r) => !r.outreach_status || r.outreach_status === "attempted"
).length;


  const yellowFlagged = records.filter((r) => r.status === "attention");
  const redFlagged = records.filter((r) => r.status === "urgent");
  const yellowContacted = yellowFlagged.filter((r) =>
    r.outreach_status === "called" || r.outreach_status === "resolved"
  ).length;
  const redContacted = redFlagged.filter((r) =>
    r.outreach_status === "called" || r.outreach_status === "resolved"
  ).length;

  // Response time metrics
  const yellowResponseTimes = yellowFlagged
    .filter((r) => r.first_outreach_at)
    .map((r) => minutesBetween(r.created_at, r.first_outreach_at!));
  const redResponseTimes = redFlagged
    .filter((r) => r.first_outreach_at)
    .map((r) => minutesBetween(r.created_at, r.first_outreach_at!));
  const resolutionTimes = flaggedRecords
    .filter((r) => r.resolved_at)
    .map((r) => minutesBetween(r.created_at, r.resolved_at!));
  const allResponseTimes = flaggedRecords
    .filter((r) => r.first_outreach_at)
    .map((r) => minutesBetween(r.created_at, r.first_outreach_at!));

  const medianYellowResponse = median(yellowResponseTimes);
  const medianRedResponse = median(redResponseTimes);
  const medianResolutionTime = median(resolutionTimes);
  const medianOverallResponse = median(allResponseTimes);

  // Red contacted within 60 min
  const redContactedFast = redFlagged.filter((r) => {
    if (!r.first_outreach_at) return false;
    return minutesBetween(r.created_at, r.first_outreach_at) <= 60;
  }).length;

  // Weekly distribution
  const weekBuckets: Record<number, { total: number; yellow: number; red: number }> = {};
  for (let w = 0; w <= 12; w++) weekBuckets[w] = { total: 0, yellow: 0, red: 0 };
  records.forEach((r) => {
    const w = Math.min(r.weeks_since_ablation, 12);
    if (!weekBuckets[w]) weekBuckets[w] = { total: 0, yellow: 0, red: 0 };
    weekBuckets[w].total++;
    if (r.status === "attention") weekBuckets[w].yellow++;
    if (r.status === "urgent") weekBuckets[w].red++;
  });
  const weeksWithData = Object.entries(weekBuckets)
    .filter(([, v]) => v.total > 0)
    .map(([k, v]) => ({ week: Number(k), ...v }));
  const maxWeekCount = Math.max(...weeksWithData.map((w) => w.total), 1);

  // Trigger distribution
  const triggerCounts: Record<string, number> = {};
  records.filter((r) => r.precipitating_factor !== "none").forEach((r) => {
    triggerCounts[r.precipitating_factor] = (triggerCounts[r.precipitating_factor] || 0) + 1;
  });
  const triggerRows = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([trigger, count]) => [
      trigger === "missed_meds" ? "Missed meds" : trigger.charAt(0).toUpperCase() + trigger.slice(1),
      count,
      pct(count, symptomCheckins),
    ]);

  // Palpitation severity
  const palp: Record<string, number> = { none: 0, mild: 0, moderate: 0, severe: 0 };
  records.forEach((r) => { if (palp[r.palpitations] !== undefined) palp[r.palpitations]++; });
  const palpRows = Object.entries(palp)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v, pct(v, totalCheckins)]);

  // Duration distribution
  const dur: Record<string, number> = { none: 0, under_5: 0, "5_30": 0, over_30: 0 };
  records.forEach((r) => { if (dur[r.duration] !== undefined) dur[r.duration]++; });
  const durRows = [
    ["None", dur.none, pct(dur.none, totalCheckins)],
    ["< 5 min", dur.under_5, pct(dur.under_5, totalCheckins)],
    ["5-30 min", dur["5_30"], pct(dur["5_30"], totalCheckins)],
    ["> 30 min", dur.over_30, pct(dur.over_30, totalCheckins)],
  ].filter(([, v]) => (v as number) > 0);

  // Patient-level table
  const patientTableRows = patientCodes.map((code) => {
    const pts = records.filter((r) => r.study_code === code);
    const yellows = pts.filter((r) => r.status === "attention").length;
    const reds = pts.filter((r) => r.status === "urgent").length;
    const erFlags = pts.filter((r) => r.would_have_gone_to_ed).length;
    const lastCheckin = pts[pts.length - 1];
    const outreachStatuses = pts.map((r) => r.outreach_status).filter(Boolean) as OutreachStatus[];
    const latestOutreach = outreachStatuses.length > 0
      ? outreachDisplayLabel(outreachStatuses[outreachStatuses.length - 1])
      : "--";
    const daysAgo = lastCheckin
      ? Math.floor((Date.now() - new Date(lastCheckin.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return [
      code,
      pts[0]?.weeks_since_ablation ?? "--",
      pts.length,
      yellows || "--",
      reds || "--",
      erFlags || "--",
      latestOutreach,
      daysAgo !== null ? `${daysAgo}d ago` : "--",
    ];
  });

  // Response time table
  const responseTimeRows = flaggedRecords
    .filter((r) => r.first_outreach_at)
    .map((r) => [
      r.study_code,
      r.status === "urgent" ? "Red" : "Yellow",
      new Date(r.created_at).toLocaleString(),
      new Date(r.first_outreach_at!).toLocaleString(),
      formatMinutes(minutesBetween(r.created_at, r.first_outreach_at!)),
      r.resolved_at ? formatMinutes(minutesBetween(r.created_at, r.resolved_at)) : "--",
    ]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, color: "#111827", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 14, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Logo size={140} />
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Pathway Performance</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Check-In</a>
            <a href="/dashboard" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>Dashboard</a>
            <a href="/history" style={{ textDecoration: "none", color: "#111827", fontSize: 14 }}>History</a>
            <a href="/performance" style={{ textDecoration: "none", color: "#111827", fontWeight: 700, fontSize: 14 }}>Performance</a>
            <button type="button" onClick={refresh} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Refresh</button>
            <button type="button" onClick={handleLogout} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Logout</button>
          </div>
        </div>

        {/* Warning banner */}
        <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5, lineHeight: 1.5, marginBottom: 24 }}>
          Internal prototype for pilot evaluation only. Do not use as the sole source of clinical decision-making. Do not enter direct patient identifiers.
        </div>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Pathway Performance</h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>Is this pathway being used, and is it changing care?</div>
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontSize: 14, padding: 24 }}>Loading...</div>
        ) : (
          <>
            {/* ── TOP SUMMARY — outcome-first ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              <SummaryCard label="Patients with Check-Ins" value={totalPatients} sub={`${medianCheckins} median check-ins`} />
              <SummaryCard label="Total Check-Ins" value={totalCheckins} sub={`${noSymptomCheckins} no symptoms`} />
              <SummaryCard label="ER Avoided" value={erAvoidanceTotal} sub={`${erAvoidancePatients} patients · ${pct(erAvoidanceTotal, symptomCheckins)} of symptomatic`} valueColor="#1d4ed8" background="#eff6ff" border="#bfdbfe" />
              <SummaryCard label="Flags Contacted" value={`${contacted} / ${totalFlags}`} sub={pct(contacted, totalFlags) + " contact rate"} valueColor={contacted === totalFlags && totalFlags > 0 ? "#16a34a" : "#d97706"} background={contacted === totalFlags && totalFlags > 0 ? "#f0fdf4" : "#fffbeb"} border={contacted === totalFlags && totalFlags > 0 ? "#bbf7d0" : "#fde68a"} />
              <SummaryCard
                label="Median Response Time"
                value={allResponseTimes.length > 0 ? formatMinutes(medianOverallResponse) : "--"}
                sub="submission to first outreach"
                valueColor="#1d4ed8"
                background="#eff6ff"
                border="#bfdbfe"
              />
              <SummaryCard
                label="Median Time to Close"
                value={resolutionTimes.length > 0 ? formatMinutes(medianResolutionTime) : "--"}
                sub="submission to resolved"
                valueColor="#16a34a"
                background="#f0fdf4"
                border="#bbf7d0"
              />
            </div>

            {/* ── Utilization ── */}
            <SectionHeader title="Utilization" subtitle="Is the pathway being used consistently?" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              <SummaryCard label="Median Check-Ins / Patient" value={medianCheckins} />
              <SummaryCard label="Symptom Check-Ins" value={symptomCheckins} sub={pct(symptomCheckins, totalCheckins) + " of total"} />
              <SummaryCard label="Callback Requests" value={callbackRequests} sub={pct(callbackRequests, totalCheckins) + " of check-ins"} />
              <SummaryCard label="Total Flags" value={totalFlags} sub={`${yellowFlags} yellow · ${redFlags} red`} />
            </div>

            {/* ── Clinical signal ── */}
            <SectionHeader title="Clinical Signal" subtitle="What is the pathway detecting?" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              <SummaryCard label="Yellow Flags" value={yellowFlags} sub={pct(yellowFlags, totalCheckins) + " of check-ins"} valueColor="#d97706" background="#fffbeb" border="#fde68a" />
              <SummaryCard label="Red Flags" value={redFlags} sub={pct(redFlags, totalCheckins) + " of check-ins"} valueColor="#dc2626" background="#fef2f2" border="#fecaca" />
              <SummaryCard label="ER Avoidance Rate" value={pct(erAvoidanceTotal, symptomCheckins)} sub="of symptom check-ins" valueColor="#1d4ed8" background="#eff6ff" border="#bfdbfe" />
              <SummaryCard label="Patients with ER Flag" value={erAvoidancePatients} sub={pct(erAvoidancePatients, totalPatients) + " of enrolled"} valueColor="#1d4ed8" />
            </div>

            {/* ── Outreach performance ── */}
            <SectionHeader title="Outreach Performance" subtitle="Are flagged patients being followed up, and how fast?" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              {/* Color-tinted contact cards */}
              <SummaryCard
                label="Yellow Contacted"
                value={`${yellowContacted} / ${yellowFlags}`}
                sub={pct(yellowContacted, yellowFlags) + " contact rate"}
                valueColor="#d97706"
                background="#fffbeb"
                border="#fde68a"
              />
              <SummaryCard
                label="Red Contacted"
                value={`${redContacted} / ${redFlags}`}
                sub={pct(redContacted, redFlags) + " contact rate"}
                valueColor="#dc2626"
                background="#fef2f2"
                border="#fecaca"
              />
              <SummaryCard
                label="Median Yellow Response"
                value={yellowResponseTimes.length > 0 ? formatMinutes(medianYellowResponse) : "--"}
                sub="submission to first outreach"
                valueColor="#d97706"
                background="#fffbeb"
                border="#fde68a"
              />
              <SummaryCard
                label="Median Red Response"
                value={redResponseTimes.length > 0 ? formatMinutes(medianRedResponse) : "--"}
                sub="submission to first outreach"
                valueColor="#dc2626"
                background="#fef2f2"
                border="#fecaca"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              <SummaryCard label="Alerts Resolved" value={resolved} sub={pct(resolved, totalFlags) + " closure rate"} valueColor="#16a34a" background="#f0fdf4" border="#bbf7d0" />
              <SummaryCard label="Unresolved Alerts" value={unresolved} sub="require follow-up" valueColor={unresolved > 0 ? "#d97706" : "#16a34a"} background={unresolved > 0 ? "#fffbeb" : "#f0fdf4"} border={unresolved > 0 ? "#fde68a" : "#bbf7d0"} />
              <SummaryCard
                label="Red Alerts Within 60 min"
                value={redFlags > 0 ? `${redContactedFast} / ${redFlags}` : "--"}
                sub={pct(redContactedFast, redFlags) + " within 1 hour"}
                valueColor="#dc2626"
              />
              <SummaryCard
                label="Median Time to Close"
                value={resolutionTimes.length > 0 ? formatMinutes(medianResolutionTime) : "--"}
                sub="submission to resolved"
                valueColor="#16a34a"
              />
            </div>

            {/* ── Response time detail table ── */}
            {responseTimeRows.length > 0 && (
              <>
                <SectionHeader title="Response Time Detail" subtitle="Submission to first outreach per flagged check-in" />
                <Table
                  headers={["Patient", "Flag", "Submitted", "First Outreach", "Response Time", "Time to Close"]}
                  rows={responseTimeRows}
                />
              </>
            )}

            {/* ── Weekly distribution ── */}
            <SectionHeader title="Check-Ins by Week Post-Ablation" subtitle="When are patients most active?" />
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", marginBottom: 8 }}>
              {weeksWithData.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No data yet.</div>
              ) : (
                weeksWithData.map((w) => (
                  <WeekBar key={w.week} week={w.week} count={w.total} max={maxWeekCount} color="#1d4ed8" />
                ))
              )}
            </div>

            {/* ── Patient-level table ── */}
            <SectionHeader title="Patient Summary" subtitle="Per-patient breakdown across the pilot" />
            <Table
              headers={["Study Code", "Week", "Check-Ins", "Yellow", "Red", "ER Avoided", "Outreach", "Last Check-In"]}
              rows={patientTableRows}
              emptyText="No patients enrolled yet."
            />

            {/* ── Signal detail ── */}
            <SectionHeader title="Signal Detail" subtitle="What symptoms are driving flags?" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Precipitating Factors</div>
                <Table headers={["Trigger", "Count", "% Symptom"]} rows={triggerRows} emptyText="No triggers recorded." />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Palpitation Severity</div>
                <Table headers={["Severity", "Count", "% All"]} rows={palpRows} emptyText="No data yet." />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Episode Duration</div>
                <Table headers={["Duration", "Count", "% All"]} rows={durRows} emptyText="No data yet." />
              </div>
            </div>

            <PrototypeFooter />
          </>
        )}
      </div>
    </main>
  );
}