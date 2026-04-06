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
  precipitatingFactor: "none" | "exertion" | "stress" | "missed_meds" | "unknown";
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
  precipitatingFactor: "none" | "exertion" | "stress" | "missed_meds" | "unknown";
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
  if (status === "urgent") return "#d32f2f";
  if (status === "attention") return "#f59e0b";
  return "#16a34a";
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
        borderRadius: 10,
        border: active ? "1px solid black" : "1px solid #d4d4d4",
        background: active ? "black" : "white",
        color: active ? "white" : "black",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
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
  const [duration, setDuration] = useState<"under_5" | "5_30" | "over_30" | "none">(
    "none"
  );
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
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        padding: 24,
        color: "#111111",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 24,
            borderBottom: "1px solid #e5e5e5",
            paddingBottom: 12,
          }}
        >
          <div style={{ fontWeight: "bold" }}>AFib Care</div>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/" style={{ textDecoration: "none", color: "black" }}>
              Check-In
            </a>
            <a
              href="/dashboard"
              style={{ textDecoration: "none", color: "black" }}
            >
              Dashboard
            </a>
          </div>
        </div>

        {step === "register" && (
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>
              Patient Registration
            </h1>
            <p style={{ color: "#666", marginBottom: 24 }}>
              Enter study code and ablation date.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{ display: "block", fontSize: 14, marginBottom: 6 }}
              >
                Study Code
              </label>
              <input
                value={studyCode}
                onChange={(e) => setStudyCode(e.target.value)}
                placeholder="PT1"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #d4d4d4",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{ display: "block", fontSize: 14, marginBottom: 6 }}
              >
                Date of Ablation
              </label>
              <input
                type="date"
                value={ablationDate}
                onChange={(e) => setAblationDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #d4d4d4",
                }}
              />
            </div>

            {ablationDate && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 12,
                  borderRadius: 10,
                  background: "#f8f8f8",
                  border: "1px solid #ececec",
                }}
              >
                Weeks since ablation: <strong>{weeksSinceAblation}</strong>
              </div>
            )}

            <button
              onClick={handleRegistrationContinue}
              disabled={!studyCode.trim() || !ablationDate}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "black",
                color: "white",
                cursor: !studyCode.trim() || !ablationDate ? "not-allowed" : "pointer",
                opacity: !studyCode.trim() || !ablationDate ? 0.5 : 1,
                fontWeight: 600,
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === "start" && (
          <div
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h1 style={{ fontSize: 32, marginBottom: 8 }}>
                How are you feeling today?
              </h1>
              <div style={{ color: "#666" }}>
                Study Code <strong>{studyCode}</strong>
              </div>
              <div style={{ color: "#666", marginTop: 4 }}>
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
                  background: "black",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
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
                  border: "1px solid #d4d4d4",
                  background: "white",
                  color: "black",
                  fontWeight: 600,
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
                  border: "1px solid #d4d4d4",
                  background: "#fafafa",
                  color: "black",
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
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h1 style={{ fontSize: 30, marginBottom: 8 }}>Symptom Details</h1>
            <p style={{ color: "#666", marginBottom: 24 }}>
              Tap the options that best match what you are having.
            </p>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Palpitations</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
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

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Duration of symptoms</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, 1fr)" }}>
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

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Chest pain</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, 1fr)" }}>
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

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Shortness of breath</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, 1fr)" }}>
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

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Precipitating factor</div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, 1fr)" }}>
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

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 14,
                  border: "1px solid #d4d4d4",
                  borderRadius: 10,
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

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep("start")}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #d4d4d4",
                  background: "white",
                  color: "black",
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
                  background: "black",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 600,
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
              border: `2px solid ${statusColor(savedRecord.status)}`,
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h1 style={{ fontSize: 30, marginBottom: 12 }}>
              Check-In Saved
            </h1>

            <div
              style={{
                fontWeight: 700,
                color: statusColor(savedRecord.status),
                fontSize: 20,
                marginBottom: 10,
              }}
            >
              {statusText(savedRecord.status)}
            </div>

            <div style={{ marginBottom: 8 }}>
              Study Code: <strong>{savedRecord.studyCode}</strong>
            </div>

            <div style={{ marginBottom: 8 }}>
              Weeks since ablation: <strong>{savedRecord.weeksSinceAblation}</strong>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: "#fafafa",
                borderRadius: 10,
                border: "1px solid #ececec",
              }}
            >
              {savedRecord.summary}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                onClick={startNewCheckIn}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid #d4d4d4",
                  background: "white",
                  color: "black",
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
                  background: "black",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}