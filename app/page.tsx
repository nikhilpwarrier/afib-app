"use client";

import { useEffect, useMemo, useState } from "react";

type Step = "register" | "start" | "symptoms" | "result";
type Status = "urgent" | "attention" | "stable";

type Registration = {
  studyCode: string;
  ablationDate: string;
};

type PatientRecord = {
  id: string;
  studyCode: string;
  ablationDate: string;
  weeksSinceAblation: number;
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  precipitatingFactor:
    | "none"
    | "exertion"
    | "stress"
    | "missed_meds"
    | "unknown";
  clinicContactMe: boolean;
  status: Status;
  summary: string;
  updatedAt: number;
};

const STORAGE_KEY = "patients";
const PROFILE_KEY = "afib_registration";

function getWeeksSinceAblation(ablationDate: string): number {
  if (!ablationDate) return 0;
  const ablation = new Date(ablationDate);
  if (Number.isNaN(ablation.getTime())) return 0;

  const diffMs = Date.now() - ablation.getTime();
  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
}

function saveRegistration(registration: Registration) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(registration));
}

function loadRegistration(): Registration | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadPatients(): PatientRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePatientRecord(record: PatientRecord) {
  const existing = loadPatients();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing]));
}

function getStatus(input: {
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  clinicContactMe: boolean;
}): Status {
  if (input.noSymptoms) return "stable";

  if (
    input.chestPain ||
    input.shortnessOfBreath === "rest" ||
    (input.palpitations === "severe" && input.duration === "over_30")
  ) {
    return "urgent";
  }

  if (
    input.palpitations === "moderate" ||
    input.palpitations === "severe" ||
    input.duration === "5_30" ||
    input.duration === "over_30" ||
    input.shortnessOfBreath === "activity" ||
    input.clinicContactMe
  ) {
    return "attention";
  }

  return "stable";
}

function buildSummary(input: {
  noSymptoms: boolean;
  palpitations: "none" | "mild" | "moderate" | "severe";
  duration: "under_5" | "5_30" | "over_30" | "none";
  chestPain: boolean;
  shortnessOfBreath: "none" | "activity" | "rest";
  precipitatingFactor:
    | "none"
    | "exertion"
    | "stress"
    | "missed_meds"
    | "unknown";
  clinicContactMe: boolean;
}): string {
  if (input.noSymptoms) return "No symptoms reported today.";

  const parts: string[] = [];

  if (input.palpitations !== "none") {
    const palpitationsLabel =
      input.palpitations.charAt(0).toUpperCase() + input.palpitations.slice(1);

    const durationLabel =
      input.duration === "under_5"
        ? "under 5 minutes"
        : input.duration === "5_30"
        ? "5 to 30 minutes"
        : input.duration === "over_30"
        ? "over 30 minutes"
        : "";

    parts.push(
      durationLabel
        ? `Palpitations: ${palpitationsLabel}, duration ${durationLabel}`
        : `Palpitations: ${palpitationsLabel}`
    );
  }

  if (input.chestPain) {
    parts.push("Chest pain present");
  }

  if (input.shortnessOfBreath === "activity") {
    parts.push("Shortness of breath with activity");
  }

  if (input.shortnessOfBreath === "rest") {
    parts.push("Shortness of breath at rest");
  }

  if (input.precipitatingFactor !== "none") {
    const precipitatingLabel =
      input.precipitatingFactor === "missed_meds"
        ? "Missed medications"
        : input.precipitatingFactor === "unknown"
        ? "Unknown"
        : input.precipitatingFactor.charAt(0).toUpperCase() +
          input.precipitatingFactor.slice(1);

    parts.push(`Precipitating factor: ${precipitatingLabel}`);
  }

  if (input.clinicContactMe) {
    parts.push("Requested clinic contact");
  }

  return parts.length > 0 ? parts.join(". ") + "." : "Symptoms reported.";
}

function statusText(status: Status) {
  if (status === "urgent") return "Urgent";
  if (status === "attention") return "Needs Attention";
  return "Stable";
}

function statusColor(status: Status) {
  if (status === "urgent") return "#dc2626";
  if (status === "attention") return "#d97706";
  return "#16a34a";
}

function statusBg(status: Status) {
  if (status === "urgent") return "#fef2f2";
  if (status === "attention") return "#fffbeb";
  return "#f0fdf4";
}

function statusBorder(status: Status) {
  if (status === "urgent") return "#fecaca";
  if (status === "attention") return "#fde68a";
  return "#bbf7d0";
}

function OptionButton({
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
        padding: "12px 16px",
        borderRadius: 12,
        border: active ? "1px solid #111827" : "1px solid #e5e7eb",
        background: active ? "#111827" : "white",
        color: active ? "white" : "#111827",
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: "pointer",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.opacity = "0.92";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      {label}
    </button>
  );
}

function Shell({
  children,
  maxWidth = 1180,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
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
      <div style={{ maxWidth, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function TopNav() {
  return (
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
          Post-Ablation Recovery Monitoring
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <a
          href="/"
          style={{ textDecoration: "none", color: "#111827", fontWeight: 700 }}
        >
          Check-In
        </a>
        <a
          href="/dashboard"
          style={{ textDecoration: "none", color: "#111827" }}
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}

function SectionBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        marginBottom: 20,
        background: "#fafafa",
      }}
    >
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("register");

  const [studyCode, setStudyCode] = useState("");
  const [ablationDate, setAblationDate] = useState("");

  const [noSymptoms, setNoSymptoms] = useState(false);

  const [palpitations, setPalpitations] = useState<
    "none" | "mild" | "moderate" | "severe"
  >("none");
  const [duration, setDuration] = useState<
    "under_5" | "5_30" | "over_30" | "none"
  >("none");
  const [chestPain, setChestPain] = useState(false);
  const [shortnessOfBreath, setShortnessOfBreath] = useState<
    "none" | "activity" | "rest"
  >("none");
  const [precipitatingFactor, setPrecipitatingFactor] = useState<
    "none" | "exertion" | "stress" | "missed_meds" | "unknown"
  >("none");
  const [clinicContactMe, setClinicContactMe] = useState(false);

  const [savedRecord, setSavedRecord] = useState<PatientRecord | null>(null);

  useEffect(() => {
    const existing = loadRegistration();
    if (existing?.studyCode && existing?.ablationDate) {
      setStudyCode(existing.studyCode);
      setAblationDate(existing.ablationDate);
      setStep("start");
    }
  }, []);

  const weeksSinceAblation = useMemo(
    () => getWeeksSinceAblation(ablationDate),
    [ablationDate]
  );

  function handleRegistrationContinue() {
    if (!studyCode.trim() || !ablationDate) return;
    saveRegistration({
      studyCode: studyCode.trim().toUpperCase(),
      ablationDate,
    });
    setStudyCode(studyCode.trim().toUpperCase());
    setStep("start");
  }

  function handleNoSymptoms() {
    const normalizedCode = studyCode.trim().toUpperCase();
    const status: Status = "stable";
    const summary = "No symptoms reported today.";

    const record: PatientRecord = {
      id: crypto.randomUUID(),
      studyCode: normalizedCode,
      ablationDate,
      weeksSinceAblation,
      noSymptoms: true,
      palpitations: "none",
      duration: "none",
      chestPain: false,
      shortnessOfBreath: "none",
      precipitatingFactor: "none",
      clinicContactMe: false,
      status,
      summary,
      updatedAt: Date.now(),
    };

    savePatientRecord(record);
    setSavedRecord(record);
    setNoSymptoms(true);
    setStep("result");
  }

  function handleSubmitSymptoms() {
    const normalizedCode = studyCode.trim().toUpperCase();

    const status = getStatus({
      noSymptoms: false,
      palpitations,
      duration,
      chestPain,
      shortnessOfBreath,
      clinicContactMe,
    });

    const summary = buildSummary({
      noSymptoms: false,
      palpitations,
      duration,
      chestPain,
      shortnessOfBreath,
      precipitatingFactor,
      clinicContactMe,
    });

    const record: PatientRecord = {
      id: crypto.randomUUID(),
      studyCode: normalizedCode,
      ablationDate,
      weeksSinceAblation,
      noSymptoms: false,
      palpitations,
      duration,
      chestPain,
      shortnessOfBreath,
      precipitatingFactor,
      clinicContactMe,
      status,
      summary,
      updatedAt: Date.now(),
    };

    savePatientRecord(record);
    setSavedRecord(record);
    setStep("result");
  }

  function resetSymptoms() {
    setNoSymptoms(false);
    setPalpitations("none");
    setDuration("none");
    setChestPain(false);
    setShortnessOfBreath("none");
    setPrecipitatingFactor("none");
    setClinicContactMe(false);
  }

  function startNewCheckIn() {
    resetSymptoms();
    setSavedRecord(null);
    setStep("start");
  }

  return (
    <Shell>
      <TopNav />

      {step === "register" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            minHeight: "calc(100vh - 120px)",
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 55%, #172554 100%)",
              color: "white",
              padding: 48,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 20 }}>
              AtriaCare
            </div>

            <div
              style={{
                fontSize: 38,
                lineHeight: 1.15,
                fontWeight: 700,
                maxWidth: 460,
                marginBottom: 18,
              }}
            >
              Post-Ablation Recovery Monitoring
            </div>

            <div
              style={{
                fontSize: 18,
                lineHeight: 1.5,
                opacity: 0.92,
                maxWidth: 440,
              }}
            >
              Daily symptom check-ins designed to support early recovery after
              AF ablation and streamline follow-up workflow.
            </div>

            <div
              style={{
                marginTop: 42,
                fontSize: 14,
                opacity: 0.8,
                maxWidth: 420,
              }}
            >
              Patient-reported symptoms, simple triage, and actionable clinical
              follow-up.
            </div>
          </div>

          <div
            style={{
              padding: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: "#ffffff",
            }}
          >
            <div style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                  Begin Check-In
                </div>
                <div style={{ color: "#64748b", fontSize: 15 }}>
                  Enter your study code and ablation date to continue.
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginBottom: 8,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Study Code
                </label>
                <input
                  value={studyCode}
                  onChange={(e) => setStudyCode(e.target.value)}
                  placeholder="PT1"
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 15,
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginBottom: 8,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Date of Ablation
                </label>
                <input
                  type="date"
                  value={ablationDate}
                  onChange={(e) => setAblationDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    fontSize: 15,
                  }}
                />
              </div>

              {ablationDate && (
                <div
                  style={{
                    marginBottom: 22,
                    padding: 14,
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 15,
                  }}
                >
                  Weeks since ablation: <strong>{weeksSinceAblation}</strong>
                </div>
              )}

              <button
                onClick={handleRegistrationContinue}
                disabled={!studyCode.trim() || !ablationDate}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "none",
                  background: "#1d4ed8",
                  color: "white",
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  fontSize: 15,
                  cursor:
                    !studyCode.trim() || !ablationDate
                      ? "not-allowed"
                      : "pointer",
                  opacity: !studyCode.trim() || !ablationDate ? 0.5 : 1,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.92";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = !studyCode.trim() ||
                    !ablationDate
                    ? "0.5"
                    : "1";
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "start" && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 28,
            maxWidth: 760,
            margin: "0 auto",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>
              How are you feeling today?
            </h1>
            <div style={{ color: "#64748b" }}>
              Study Code <strong>{studyCode}</strong>
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Post-ablation • Week <strong>{weeksSinceAblation}</strong>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              onClick={handleNoSymptoms}
              style={{
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: "#111827",
                color: "white",
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: "pointer",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = "0.92";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              No symptoms today
            </button>

            <button
              onClick={() => {
                resetSymptoms();
                setStep("symptoms");
              }}
              style={{
                padding: "16px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                fontWeight: 700,
                letterSpacing: 0.2,
                cursor: "pointer",
              }}
            >
              I have symptoms
            </button>

            <button
              onClick={() => setStep("register")}
              style={{
                padding: "12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              Edit registration
            </button>
          </div>
        </div>
      )}

      {step === "symptoms" && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 28,
            maxWidth: 860,
            margin: "0 auto",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>Symptom Details</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>
            Tap the options that best match what you are having.
          </p>

          <SectionBox title="Rhythm Symptoms">
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Palpitations</div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(4, 1fr)",
                }}
              >
                <OptionButton
                  label="None"
                  active={palpitations === "none"}
                  onClick={() => {
                    setPalpitations("none");
                    setDuration("none");
                  }}
                />
                <OptionButton
                  label="Mild"
                  active={palpitations === "mild"}
                  onClick={() => setPalpitations("mild")}
                />
                <OptionButton
                  label="Moderate"
                  active={palpitations === "moderate"}
                  onClick={() => setPalpitations("moderate")}
                />
                <OptionButton
                  label="Severe"
                  active={palpitations === "severe"}
                  onClick={() => setPalpitations("severe")}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Duration of symptoms
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                <OptionButton
                  label="< 5 min"
                  active={duration === "under_5"}
                  onClick={() => setDuration("under_5")}
                />
                <OptionButton
                  label="5–30 min"
                  active={duration === "5_30"}
                  onClick={() => setDuration("5_30")}
                />
                <OptionButton
                  label="> 30 min"
                  active={duration === "over_30"}
                  onClick={() => setDuration("over_30")}
                />
              </div>
            </div>
          </SectionBox>

          <SectionBox title="High-Risk Symptoms">
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Chest pain</div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(2, 1fr)",
                }}
              >
                <OptionButton
                  label="No"
                  active={!chestPain}
                  onClick={() => setChestPain(false)}
                />
                <OptionButton
                  label="Yes"
                  active={chestPain}
                  onClick={() => setChestPain(true)}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Shortness of breath
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                <OptionButton
                  label="None"
                  active={shortnessOfBreath === "none"}
                  onClick={() => setShortnessOfBreath("none")}
                />
                <OptionButton
                  label="With activity"
                  active={shortnessOfBreath === "activity"}
                  onClick={() => setShortnessOfBreath("activity")}
                />
                <OptionButton
                  label="At rest"
                  active={shortnessOfBreath === "rest"}
                  onClick={() => setShortnessOfBreath("rest")}
                />
              </div>
            </div>
          </SectionBox>

          <SectionBox title="Triggers (Optional)">
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Precipitating factor
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                <OptionButton
                  label="None"
                  active={precipitatingFactor === "none"}
                  onClick={() => setPrecipitatingFactor("none")}
                />
                <OptionButton
                  label="Exertion"
                  active={precipitatingFactor === "exertion"}
                  onClick={() => setPrecipitatingFactor("exertion")}
                />
                <OptionButton
                  label="Stress"
                  active={precipitatingFactor === "stress"}
                  onClick={() => setPrecipitatingFactor("stress")}
                />
                <OptionButton
                  label="Missed meds"
                  active={precipitatingFactor === "missed_meds"}
                  onClick={() => setPrecipitatingFactor("missed_meds")}
                />
                <OptionButton
                  label="Unknown"
                  active={precipitatingFactor === "unknown"}
                  onClick={() => setPrecipitatingFactor("unknown")}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "white",
                }}
              >
                <input
                  type="checkbox"
                  checked={clinicContactMe}
                  onChange={(e) => setClinicContactMe(e.target.checked)}
                />
                <span>Have clinic contact me</span>
              </label>
            </div>
          </SectionBox>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep("start")}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Back
            </button>

            <button
              onClick={handleSubmitSymptoms}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = "0.92";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Submit Check-In
            </button>
          </div>
        </div>
      )}

      {step === "result" && savedRecord && (
        <div
          style={{
            border: `1px solid ${statusBorder(savedRecord.status)}`,
            background: "white",
            borderRadius: 18,
            padding: 28,
            maxWidth: 760,
            margin: "0 auto",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>
            {savedRecord.status === "urgent" && "⚠️ We Recommend Follow-Up"}
            {savedRecord.status === "attention" && "We’ll Review Your Symptoms"}
            {savedRecord.status === "stable" && "Everything Looks Good Today"}
          </h1>

          <div
            style={{
              display: "inline-block",
              fontWeight: 700,
              color: statusColor(savedRecord.status),
              fontSize: 18,
              marginBottom: 14,
              background: statusBg(savedRecord.status),
              border: `1px solid ${statusBorder(savedRecord.status)}`,
              padding: "8px 12px",
              borderRadius: 999,
            }}
          >
            {statusText(savedRecord.status)}
          </div>

          <div style={{ marginBottom: 8 }}>
            Study Code: <strong>{savedRecord.studyCode}</strong>
          </div>

          <div style={{ marginBottom: 8 }}>
            Weeks since ablation:{" "}
            <strong>{savedRecord.weeksSinceAblation}</strong>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              color: "#334155",
            }}
          >
            {savedRecord.summary}
          </div>

          {savedRecord.status === "urgent" && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              Please contact your care team or seek urgent evaluation if
              symptoms worsen.
            </div>
          )}

          {savedRecord.status === "attention" && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
              }}
            >
              Your care team may follow up based on your symptoms.
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              onClick={startNewCheckIn}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              New Check-In
            </button>

            <a
              href="/dashboard"
              style={{
                display: "inline-block",
                padding: "12px 18px",
                borderRadius: 10,
                background: "#111827",
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )}
    </Shell>
  );
}