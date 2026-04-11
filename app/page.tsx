"use client";

import Logo from "@/components/Logo";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Step = "register" | "start" | "symptoms" | "result";
type Status = "urgent" | "attention" | "stable" | "expected";

type Registration = {
  studyCode: string;
  ablationDate: string;
};

type SavedRecord = {
  id?: string;
  studyCode: string;
  ablationDate: string;
  weeksSinceAblation: number;
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  precipitatingFactor: "none" | "exertion" | "stress" | "missed_meds" | "alcohol" | "unknown";
  clinicContactMe: boolean;
  wouldHaveGoneToED: boolean;
  status: "urgent" | "attention" | "stable";
  summary: string;
  created_at?: string;
};

type PriorCheckin = {
  status: "urgent" | "attention" | "stable";
  created_at: string;
};

const PROFILE_KEY = "afib_registration";

function lastCheckinKey(studyCode: string): string {
  return `afib_last_checkin_${studyCode.trim().toUpperCase()}`;
}

function normalizeStudyCode(value: string): string {
  return value.trim().toUpperCase();
}

function getWeeksSinceAblation(ablationDate: string): number {
  if (!ablationDate) return 0;
  const ablation = new Date(ablationDate);
  if (Number.isNaN(ablation.getTime())) return 0;
  const diffMs = Date.now() - ablation.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  return !Number.isNaN(new Date(dateStr).getTime());
}

function saveRegistration(registration: Registration) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(registration));
}

function loadRegistration(): Registration | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.studyCode || !parsed?.ablationDate || !isValidDate(parsed.ablationDate)) return null;
    return parsed;
  } catch { return null; }
}

function saveLastCheckin(studyCode: string) {
  localStorage.setItem(lastCheckinKey(studyCode), new Date().toISOString());
}

function loadLastCheckin(studyCode: string): string | null {
  try { return localStorage.getItem(lastCheckinKey(studyCode)); }
  catch { return null; }
}

function timeAgoShort(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "yesterday";
  return `${Math.floor(diff / 86400)} days ago`;
}

function getCheckinFrequencyHint(weeks: number): string {
  if (weeks <= 4) return "Check in 2-3 times per week during your first 4 weeks.";
  return "Check in once a week, or any time you have symptoms.";
}

function getTrendLine(priorCheckins: PriorCheckin[]): string | null {
  if (priorCheckins.length < 3) return null;
  const last5 = priorCheckins.slice(-5);
  const latest = last5[last5.length - 1];
  const allStable = last5.every((c) => c.status === "stable");
  const priorStable = last5.slice(0, -1).every((c) => c.status === "stable");
  const anyUrgent = last5.some((c) => c.status === "urgent");
  const anyAttention = last5.some((c) => c.status === "attention");

  if (allStable) return "You have been stable across your recent check-ins.";
  if (latest.status !== "stable" && priorStable) return "This is your first concerning symptom in a while.";
  if (anyUrgent) return "Your care team is tracking your recent symptoms closely.";
  if (anyAttention) return "We have seen this pattern before — your care team will review it.";
  return "Your care team is monitoring your check-in pattern.";
}

function getTriageStatus(input: {
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  clinicContactMe: boolean;
  wouldHaveGoneToED: boolean;
}): "urgent" | "attention" | "stable" {
  if (input.noSymptoms) return "stable";
  if (
    input.chestPain ||
    input.shortnessOfBreath === "rest" ||
    (input.palpitations === "severe" && input.duration === "over_30")
  ) return "urgent";
  if (
    input.palpitations === "moderate" ||
    input.palpitations === "severe" ||
    input.duration === "5_30" ||
    input.duration === "over_30" ||
    input.shortnessOfBreath === "activity" ||
    input.clinicContactMe ||
    input.wouldHaveGoneToED
  ) return "attention";
  return "stable";
}

function getDisplayStatus(
  triageStatus: "urgent" | "attention" | "stable",
  noSymptoms: boolean
): Status {
  if (triageStatus === "urgent") return "urgent";
  if (triageStatus === "attention") return "attention";
  if (noSymptoms) return "stable";
  return "expected";
}

function buildSummary(input: {
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  precipitatingFactor: "none" | "exertion" | "stress" | "missed_meds" | "alcohol" | "unknown";
  clinicContactMe: boolean;
  wouldHaveGoneToED: boolean;
}): string {
  if (input.noSymptoms) return "No symptoms reported today.";
  const parts: string[] = [];
  if (input.palpitations !== "none") {
    const label = input.palpitations.charAt(0).toUpperCase() + input.palpitations.slice(1);
    const dur = input.duration === "under_5" ? "under 5 minutes"
      : input.duration === "5_30" ? "5 to 30 minutes"
      : input.duration === "over_30" ? "over 30 minutes" : "";
    parts.push(dur ? `Palpitations: ${label}, duration ${dur}` : `Palpitations: ${label}`);
  }
  if (input.chestPain) parts.push("Chest pain present");
  if (input.shortnessOfBreath === "activity") parts.push("Shortness of breath with activity");
  if (input.shortnessOfBreath === "rest") parts.push("Shortness of breath at rest");
  if (input.precipitatingFactor !== "none") {
    const label =
      input.precipitatingFactor === "missed_meds" ? "Missed medications"
      : input.precipitatingFactor === "alcohol" ? "Alcohol"
      : input.precipitatingFactor === "unknown" ? "Unknown"
      : input.precipitatingFactor.charAt(0).toUpperCase() + input.precipitatingFactor.slice(1);
    parts.push(`Precipitating factor: ${label}`);
  }
  if (input.clinicContactMe) parts.push("Requested clinic contact");
  if (input.wouldHaveGoneToED) parts.push("Would have gone to the ER without this check-in");
  return parts.length > 0 ? parts.join(". ") + "." : "Symptoms reported.";
}

function getReassuranceText(status: Status, weeks: number): string {
  if (status === "stable") {
    if (weeks <= 4) return "No symptoms today is a great sign. Many patients experience their best days during early recovery.";
    return "Staying symptom-free is the best possible outcome at this stage of recovery.";
  }
  if (status === "expected") {
    if (weeks <= 4) return "Mild symptoms like these are common in the first few weeks after ablation. The heart is still settling.";
    if (weeks <= 8) return "Some palpitations during weeks 4-8 are part of normal recovery. Your care team is tracking your pattern.";
    return "Occasional mild symptoms at this stage are expected. Your check-in has been recorded.";
  }
  if (status === "attention") return "We have seen this pattern before and your care team will review it.";
  if (status === "urgent") return "Based on what you reported, your check-in has been flagged for same-day review.";
  return "";
}

function OptionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: "12px 16px", borderRadius: 12, border: active ? "1px solid #111827" : "1px solid #d4d4d4", background: active ? "#111827" : "white", color: active ? "white" : "#111827", fontWeight: 600, cursor: "pointer", fontSize: 14, boxSizing: "border-box" }}>
      {label}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, color: "#111827", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function TopNav() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 12, alignItems: "center" }}>
      <div>
        <Logo />
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>Post-Ablation Check-In</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("register");
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [studyCode, setStudyCode] = useState("");
  const [ablationDate, setAblationDate] = useState("");
  const [lastCheckin, setLastCheckin] = useState<string | null>(null);
  const [priorCheckins, setPriorCheckins] = useState<PriorCheckin[]>([]);
  const [registrationError, setRegistrationError] = useState("");

  const [palpitations, setPalpitations] = useState<"none" | "mild" | "moderate" | "severe">("none");
  const [duration, setDuration] = useState<"under_5" | "5_30" | "over_30" | "none">("none");
  const [chestPain, setChestPain] = useState(false);
  const [shortnessOfBreath, setShortnessOfBreath] = useState<"none" | "activity" | "rest">("none");
  const [precipitatingFactor, setPrecipitatingFactor] = useState<"none" | "exertion" | "stress" | "missed_meds" | "alcohol" | "unknown">("none");
  const [clinicContactMe, setClinicContactMe] = useState(false);
  const [wouldHaveGoneToED, setWouldHaveGoneToED] = useState(false);

  const [savedRecord, setSavedRecord] = useState<SavedRecord | null>(null);
  const [displayStatus, setDisplayStatus] = useState<Status>("stable");

  async function loadPriorCheckins(code: string) {
    const { data } = await supabase
      .from("checkins")
      .select("status, created_at")
      .eq("study_code", normalizeStudyCode(code))
      .order("created_at", { ascending: true });
    if (data) setPriorCheckins(data as PriorCheckin[]);
  }

  useEffect(() => {
    const existing = loadRegistration();
    if (existing?.studyCode && existing?.ablationDate) {
      const code = normalizeStudyCode(existing.studyCode);
      setStudyCode(code);
      setAblationDate(existing.ablationDate);
      setLastCheckin(loadLastCheckin(code));
      loadPriorCheckins(code);
      setStep("start");
    }
  }, []);

  useEffect(() => {
    const updateSize = () => setIsMobile(window.innerWidth < 900);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const weeksSinceAblation = useMemo(() => getWeeksSinceAblation(ablationDate), [ablationDate]);
  const checkinHint = useMemo(() => getCheckinFrequencyHint(weeksSinceAblation), [weeksSinceAblation]);
  const trendLine = useMemo(() => getTrendLine(priorCheckins), [priorCheckins]);

  const hasAnyReportedSymptom =
    palpitations !== "none" ||
    chestPain ||
    shortnessOfBreath !== "none" ||
    clinicContactMe ||
    wouldHaveGoneToED;

  async function handleRegistrationContinue() {
  setRegistrationError("");

  if (!studyCode.trim() || !ablationDate || !isValidDate(ablationDate)) return;

  const normalized = normalizeStudyCode(studyCode);

  // 🔑 Check against Supabase allowlist
  const { data, error } = await supabase
    .from("allowed_study_codes")
    .select("study_code, active")
    .eq("study_code", normalized)
    .single();

  if (error || !data || !data.active) {
    setRegistrationError("Study code not recognized. Please check with your care team.");
    return;
  }

  // ✅ Valid → proceed
  saveRegistration({ studyCode: normalized, ablationDate });
  setStudyCode(normalized);
  setLastCheckin(loadLastCheckin(normalized));
  loadPriorCheckins(normalized);
  setStep("start");
}

  function handleEditRegistration() { setStep("register"); }

  async function saveCheckin(record: SavedRecord) {
    setSubmitting(true);
    const payload = {
      study_code: record.studyCode,
      ablation_date: record.ablationDate,
      weeks_since_ablation: record.weeksSinceAblation,
      no_symptoms: record.noSymptoms,
      palpitations: record.palpitations,
      duration: record.duration,
      chest_pain: record.chestPain,
      shortness_of_breath: record.shortnessOfBreath,
      precipitating_factor: record.precipitatingFactor,
      clinic_contact_me: record.clinicContactMe,
      would_have_gone_to_ed: record.wouldHaveGoneToED,
      status: record.status,
      summary: record.summary,
    };
    const { data, error } = await supabase.from("checkins").insert([payload]).select().single();
    setSubmitting(false);
    if (error) { console.error(error); alert("Error saving check-in"); return; }
    saveLastCheckin(record.studyCode);
    setLastCheckin(new Date().toISOString());
    await loadPriorCheckins(record.studyCode);
    setSavedRecord({ ...record, id: data.id, created_at: data.created_at });
    setStep("result");
  }

  async function handleNoSymptoms() {
    const code = normalizeStudyCode(studyCode);
    const record: SavedRecord = {
      studyCode: code, ablationDate, weeksSinceAblation,
      noSymptoms: true, palpitations: "none", duration: "none",
      chestPain: false, shortnessOfBreath: "none", precipitatingFactor: "none",
      clinicContactMe: false, wouldHaveGoneToED: false,
      status: "stable", summary: "No symptoms reported today.",
    };
    setDisplayStatus("stable");
    await saveCheckin(record);
  }

  async function handleSubmitSymptoms() {
    if (!hasAnyReportedSymptom) return;
    const code = normalizeStudyCode(studyCode);
    const triageStatus = getTriageStatus({
      noSymptoms: false, palpitations, duration, chestPain,
      shortnessOfBreath, clinicContactMe, wouldHaveGoneToED,
    });
    const summary = buildSummary({
      noSymptoms: false, palpitations, duration, chestPain,
      shortnessOfBreath, precipitatingFactor, clinicContactMe, wouldHaveGoneToED,
    });
    const record: SavedRecord = {
      studyCode: code, ablationDate, weeksSinceAblation,
      noSymptoms: false, palpitations, duration, chestPain, shortnessOfBreath,
      precipitatingFactor, clinicContactMe, wouldHaveGoneToED,
      status: triageStatus, summary,
    };
    setDisplayStatus(getDisplayStatus(triageStatus, false));
    await saveCheckin(record);
  }

  function resetSymptoms() {
    setPalpitations("none"); setDuration("none"); setChestPain(false);
    setShortnessOfBreath("none"); setPrecipitatingFactor("none");
    setClinicContactMe(false); setWouldHaveGoneToED(false);
  }

  function startNewCheckIn() { resetSymptoms(); setSavedRecord(null); setStep("start"); }

  const currentWeek = savedRecord?.weeksSinceAblation ?? weeksSinceAblation;
  const reassuranceText = getReassuranceText(displayStatus, currentWeek);

  const resultConfig: Record<Status, {
    headline: string; sub: string; actionNote?: string;
    color: string; bg: string; border: string; pillLabel: string;
  }> = {
    stable: {
      headline: "You're doing great.",
      sub: "No symptoms today. Keep checking in — consistency is what makes this work.",
      color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", pillLabel: "All Clear",
    },
    expected: {
      headline: "This looks like expected recovery.",
      sub: `What you reported is within the normal range for week ${currentWeek} of recovery. Your check-in has been recorded.`,
      actionNote: "No action needed right now. If symptoms worsen, check in again.",
      color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", pillLabel: "Expected Recovery",
    },
    attention: {
      headline: "We'll review your symptoms.",
      sub: "Your care team will follow up based on what you reported. Your check-in has been flagged for review.",
      actionNote: "If symptoms worsen before we reach you, call your care team directly.",
      color: "#d97706", bg: "#fffbeb", border: "#fde68a", pillLabel: "Needs Attention",
    },
    urgent: {
      headline: "Please contact your care team.",
      sub: "Based on what you reported, your check-in has been flagged for same-day review.",
      actionNote: "If symptoms worsen before we reach you — call 911 or go to the nearest emergency room immediately.",
      color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pillLabel: "Urgent",
    },
  };

  const result = resultConfig[displayStatus];

  return (
    <Shell>
      <TopNav />

      {/* ── Register ── */}
      {step === "register" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", minHeight: isMobile ? "auto" : "calc(100vh - 120px)", borderRadius: 20, overflow: "hidden", border: "1px solid #e5e7eb", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {!isMobile && (
            <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 55%, #172554 100%)", color: "white", padding: 48, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 20 }}>AtriaCare</div>
              <div style={{ fontSize: 38, lineHeight: 1.15, fontWeight: 700, maxWidth: 460, marginBottom: 18 }}>Post-Ablation Recovery Monitoring</div>
              <div style={{ fontSize: 18, lineHeight: 1.5, opacity: 0.92, maxWidth: 440 }}>Daily symptom check-ins designed to support your early recovery after AF ablation.</div>
              <div style={{ marginTop: 42, fontSize: 14, opacity: 0.8, maxWidth: 420 }}>Your care team reviews every check-in. You are not alone in this.</div>
            </div>
          )}
          <div style={{ padding: isMobile ? 24 : 40, display: "flex", flexDirection: "column", justifyContent: "center", background: "#ffffff" }}>
            <div style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, marginBottom: 8 }}>Start Check-In</div>
                <div style={{ color: "#64748b", fontSize: 15 }}>Enter your study code and ablation date to continue.</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 14, marginBottom: 8, fontWeight: 600, color: "#111827" }}>Study Code</label>
                <input value={studyCode} onChange={(e) => setStudyCode(e.target.value)} placeholder="e.g. PT1" style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 14, marginBottom: 8, fontWeight: 600, color: "#111827" }}>Date of Ablation</label>
                <input type="date" value={ablationDate} onChange={(e) => setAblationDate(e.target.value)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15, boxSizing: "border-box" }} />
              </div>
              {ablationDate && isValidDate(ablationDate) && (
                <div style={{ marginBottom: 22, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 15 }}>
                  Weeks since ablation: <strong>{weeksSinceAblation}</strong>
                </div>
              )}
        
              {registrationError && (
  <div
    style={{
      marginBottom: 16,
      color: "#b91c1c",
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
    }}
  >
    {registrationError}
  </div>
)}
              <button onClick={handleRegistrationContinue} disabled={!studyCode.trim() || !ablationDate || !isValidDate(ablationDate)} style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "none", background: "#1d4ed8", color: "white", fontWeight: 700, fontSize: 15, cursor: !studyCode.trim() || !ablationDate ? "not-allowed" : "pointer", opacity: !studyCode.trim() || !ablationDate ? 0.5 : 1, boxSizing: "border-box" }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Start ── */}
      {step === "start" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 28, maxWidth: 760, margin: "0 auto", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 32, marginBottom: 8, marginTop: 0 }}>How are you feeling today?</h1>
            <div style={{ color: "#64748b" }}>Study Code <strong>{studyCode}</strong></div>
            <div style={{ color: "#64748b", marginTop: 4 }}>Post-ablation · Week <strong>{weeksSinceAblation}</strong></div>
          </div>

          {/* Recovery guidance */}
          <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Recovery Guidance</div>
            {lastCheckin && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                Last check-in: <strong>{timeAgoShort(lastCheckin)}</strong>
              </div>
            )}
            {trendLine && (
              <div style={{ fontSize: 13, color: "#334155", marginBottom: 6, fontWeight: 500 }}>{trendLine}</div>
            )}
            <div style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 500 }}>{checkinHint}</div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button onClick={handleNoSymptoms} disabled={submitting} style={{ padding: 16, borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 700, fontSize: 15, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, boxSizing: "border-box" }}>
              {submitting ? "Submitting..." : "No symptoms today"}
            </button>
            <button onClick={() => { resetSymptoms(); setStep("symptoms"); }} disabled={submitting} style={{ padding: 16, borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 15, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, boxSizing: "border-box" }}>
              I have symptoms
            </button>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, color: "#b91c1c", fontWeight: 500, lineHeight: 1.5 }}>
            If you are experiencing chest pain, severe shortness of breath, or feel unsafe — call 911 or go to the nearest emergency room immediately.
          </div>

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button onClick={handleEditRegistration} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Edit registration
            </button>
          </div>
        </div>
      )}

      {/* ── Symptoms ── */}
      {step === "symptoms" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 28, maxWidth: 860, margin: "0 auto", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h1 style={{ fontSize: 30, marginBottom: 6, marginTop: 0 }}>Symptom Details</h1>
          <p style={{ color: "#64748b", marginBottom: 24, marginTop: 0 }}>Select the options that best match how you feel.</p>

          {/* Rhythm */}
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, background: "#fafafa" }}>
            <h2 style={{ fontSize: 18, marginBottom: 14, marginTop: 0 }}>Rhythm Symptoms</h2>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Palpitations</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)" }}>
                <OptionButton label="None" active={palpitations === "none"} onClick={() => { setPalpitations("none"); setDuration("none"); }} />
                <OptionButton label="Mild" active={palpitations === "mild"} onClick={() => setPalpitations("mild")} />
                <OptionButton label="Moderate" active={palpitations === "moderate"} onClick={() => setPalpitations("moderate")} />
                <OptionButton label="Severe" active={palpitations === "severe"} onClick={() => setPalpitations("severe")} />
              </div>
            </div>
            {palpitations !== "none" && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Duration of symptoms</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)" }}>
                  <OptionButton label="< 5 min" active={duration === "under_5"} onClick={() => setDuration("under_5")} />
                  <OptionButton label="5-30 min" active={duration === "5_30"} onClick={() => setDuration("5_30")} />
                  <OptionButton label="> 30 min" active={duration === "over_30"} onClick={() => setDuration("over_30")} />
                </div>
              </div>
            )}
          </div>

          {/* High risk */}
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, background: "#fafafa" }}>
            <h2 style={{ fontSize: 18, marginBottom: 14, marginTop: 0 }}>High-Risk Symptoms</h2>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Chest pain</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)" }}>
                <OptionButton label="No" active={!chestPain} onClick={() => setChestPain(false)} />
                <OptionButton label="Yes" active={chestPain} onClick={() => setChestPain(true)} />
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Shortness of breath</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)" }}>
                <OptionButton label="None" active={shortnessOfBreath === "none"} onClick={() => setShortnessOfBreath("none")} />
                <OptionButton label="With activity" active={shortnessOfBreath === "activity"} onClick={() => setShortnessOfBreath("activity")} />
                <OptionButton label="At rest" active={shortnessOfBreath === "rest"} onClick={() => setShortnessOfBreath("rest")} />
              </div>
            </div>
          </div>

          {/* Triggers */}
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 20, background: "#fafafa" }}>
            <h2 style={{ fontSize: 18, marginBottom: 14, marginTop: 0 }}>Triggers (Optional)</h2>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Precipitating factor</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)" }}>
                <OptionButton label="None" active={precipitatingFactor === "none"} onClick={() => setPrecipitatingFactor("none")} />
                <OptionButton label="Exertion" active={precipitatingFactor === "exertion"} onClick={() => setPrecipitatingFactor("exertion")} />
                <OptionButton label="Stress" active={precipitatingFactor === "stress"} onClick={() => setPrecipitatingFactor("stress")} />
                <OptionButton label="Missed meds" active={precipitatingFactor === "missed_meds"} onClick={() => setPrecipitatingFactor("missed_meds")} />
                <OptionButton label="Alcohol" active={precipitatingFactor === "alcohol"} onClick={() => setPrecipitatingFactor("alcohol")} />
                <OptionButton label="Unknown" active={precipitatingFactor === "unknown"} onClick={() => setPrecipitatingFactor("unknown")} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, border: "1px solid #d1d5db", borderRadius: 12, background: "white", cursor: "pointer", boxSizing: "border-box" }}>
                <input type="checkbox" checked={clinicContactMe} onChange={(e) => setClinicContactMe(e.target.checked)} />
                <span style={{ fontSize: 14 }}>Have clinic contact me</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, border: wouldHaveGoneToED ? "1px solid #fde68a" : "1px solid #d1d5db", borderRadius: 12, background: wouldHaveGoneToED ? "#fffbeb" : "white", cursor: "pointer", boxSizing: "border-box" }}>
                <input type="checkbox" checked={wouldHaveGoneToED} onChange={(e) => setWouldHaveGoneToED(e.target.checked)} />
                <span style={{ fontSize: 14 }}>Without this app, I would have gone to the ER</span>
              </label>
            </div>
          </div>

          {/* Empty symptom warning */}
          {!hasAnyReportedSymptom && (
            <div style={{ marginBottom: 12, fontSize: 13, color: "#64748b", padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              Please select at least one symptom or concern before submitting.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
            <button onClick={() => setStep("start")} disabled={submitting} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 600, opacity: submitting ? 0.6 : 1, boxSizing: "border-box" }}>
              Back
            </button>
            <button onClick={handleSubmitSymptoms} disabled={submitting || !hasAnyReportedSymptom} style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: "#111827", color: "white", cursor: submitting || !hasAnyReportedSymptom ? "not-allowed" : "pointer", fontWeight: 700, opacity: submitting || !hasAnyReportedSymptom ? 0.6 : 1, boxSizing: "border-box" }}>
              {submitting ? "Submitting..." : "Submit Check-In"}
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {step === "result" && savedRecord && result && (
        <div style={{ border: `1px solid ${result.border}`, background: "white", borderRadius: 18, padding: 28, maxWidth: 760, margin: "0 auto", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>

          <div style={{ height: 4, background: result.color, margin: "-28px -28px 24px -28px" }} />

          <div style={{ display: "inline-block", fontWeight: 700, color: result.color, fontSize: 12, marginBottom: 14, background: result.bg, border: `1px solid ${result.border}`, padding: "5px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {result.pillLabel}
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, marginTop: 0, letterSpacing: "-0.3px" }}>
            {result.headline}
          </h1>

          <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.6, marginBottom: 12, marginTop: 0 }}>
            {result.sub}
          </p>

          <div style={{ padding: "12px 14px", borderRadius: 10, background: result.bg, border: `1px solid ${result.border}`, fontSize: 14, color: result.color, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>
            {reassuranceText}
          </div>

          {result.actionNote && (
            <p style={{ fontSize: 14, color: result.color, fontWeight: 600, lineHeight: 1.5, marginBottom: 16, marginTop: 0 }}>
              {result.actionNote}
            </p>
          )}

          {savedRecord.wouldHaveGoneToED && (
            <div style={{ padding: 14, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Your check-in may have helped you avoid an unnecessary ER visit today.
            </div>
          )}

          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#64748b", marginBottom: 20 }}>
            {checkinHint}
          </div>

          <button onClick={startNewCheckIn} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", cursor: "pointer", fontWeight: 600, fontSize: 14, boxSizing: "border-box" }}>
            New Check-In
          </button>
        </div>
      )}
    </Shell>
  );
}