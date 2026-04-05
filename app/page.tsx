"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluateCheckIn,
  type Palpitations,
  type ShortnessOfBreath,
  type Lightheadedness,
} from "@/lib/triage";
import {
  type PatientProfile,
  type StoredCheckIn,
  loadProfiles,
  saveProfiles,
  loadCurrentPatientCode,
  saveCurrentPatientCode,
  getPatientCheckIns,
  addPatientCheckIn,
} from "@/lib/storage";

const defaultProfile: PatientProfile = {
  studyCode: "",
  weeksSinceAblation: "",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTrendText(entries: StoredCheckIn[]): string {
  const recent = entries.slice(0, 3).map((e) => e.result);

  if (recent.length < 2) return "No clear trend yet";
  if (recent.every((r) => r === "green")) return "Stable recent check-ins";
  if (recent[0] === "red") return "Most recent check-in was urgent";
  if (recent.filter((r) => r === "yellow" || r === "red").length >= 2) {
    return "Increasing symptom burden recently";
  }
  return "No clear trend yet";
}

function levelStyles(level: "green" | "yellow" | "red") {
  switch (level) {
    case "green":
      return "border-green-200 bg-green-50 text-green-900";
    case "yellow":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    case "red":
      return "border-red-200 bg-red-50 text-red-900";
  }
}

function levelDot(level: "green" | "yellow" | "red") {
  switch (level) {
    case "green":
      return "bg-green-500";
    case "yellow":
      return "bg-yellow-500";
    case "red":
      return "bg-red-500";
  }
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-black bg-black text-white"
          : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-400"
      }`}
    >
      {label}
    </button>
  );
}

export default function HomePage() {
  const [profiles, setProfiles] = useState<Record<string, PatientProfile>>({});
  const [currentCode, setCurrentCode] = useState("");
  const [profile, setProfile] = useState<PatientProfile>(defaultProfile);
  const [checkIns, setCheckIns] = useState<StoredCheckIn[]>([]);

  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<"start" | "form" | "result">("start");

  const [palpitations, setPalpitations] = useState<Palpitations>("none");
  const [shortnessOfBreath, setShortnessOfBreath] =
    useState<ShortnessOfBreath>("none");
  const [lightheadedness, setLightheadedness] =
    useState<Lightheadedness>("none");
  const [chestPain, setChestPain] = useState(false);

  const [currentResult, setCurrentResult] = useState<{
    level: "green" | "yellow" | "red";
    title: string;
    message: string;
    summary: string;
  } | null>(null);

  useEffect(() => {
    const loadedProfiles = loadProfiles();
    const loadedCode = loadCurrentPatientCode();

    setProfiles(loadedProfiles);

    if (loadedCode && loadedProfiles[loadedCode]) {
      setCurrentCode(loadedCode);
      setProfile(loadedProfiles[loadedCode]);
      setCheckIns(getPatientCheckIns(loadedCode));
    } else {
      setShowProfileEditor(true);
    }
  }, []);

  const hasProfile =
    profile.studyCode.trim() !== "" && profile.weeksSinceAblation !== "";

  const last7DaysCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return checkIns.filter(
      (entry) => new Date(entry.created_at).getTime() >= cutoff
    ).length;
  }, [checkIns]);

  const yellowCount = useMemo(
    () => checkIns.filter((entry) => entry.result === "yellow").length,
    [checkIns]
  );

  const redCount = useMemo(
    () => checkIns.filter((entry) => entry.result === "red").length,
    [checkIns]
  );

  const lastCheckIn = checkIns[0] ?? null;
  const trendText = getTrendText(checkIns);

  function resetForm() {
    setPalpitations("none");
    setShortnessOfBreath("none");
    setLightheadedness("none");
    setChestPain(false);
  }

  function switchPatient(studyCode: string) {
    const next = profiles[studyCode];
    if (!next) return;

    setCurrentCode(studyCode);
    setProfile(next);
    setCheckIns(getPatientCheckIns(studyCode));
    saveCurrentPatientCode(studyCode);
    setMode("start");
    setCurrentResult(null);
    setShowHistory(false);
    resetForm();
  }

  function saveCurrentProfile() {
    if (!profile.studyCode.trim()) return;

    const normalized: PatientProfile = {
      studyCode: profile.studyCode.trim().toUpperCase(),
      weeksSinceAblation: profile.weeksSinceAblation,
    };

    const nextProfiles = {
      ...profiles,
      [normalized.studyCode]: normalized,
    };

    saveProfiles(nextProfiles);
    saveCurrentPatientCode(normalized.studyCode);

    setProfiles(nextProfiles);
    setCurrentCode(normalized.studyCode);
    setProfile(normalized);
    setCheckIns(getPatientCheckIns(normalized.studyCode));
    setShowProfileEditor(false);
  }

  function persistCheckIn(entry: StoredCheckIn) {
    if (!currentCode) return;
    addPatientCheckIn(currentCode, entry);
    setCheckIns(getPatientCheckIns(currentCode));
  }

  function handleNoSymptoms() {
    const result = evaluateCheckIn({
      palpitations: "none",
      shortnessOfBreath: "none",
      lightheadedness: "none",
      chestPain: false,
    });

    const entry: StoredCheckIn = {
      created_at: new Date().toISOString(),
      result: result.level,
      title: result.title,
      message: result.message,
      summary: result.summary,
      palpitations: "none",
      shortnessOfBreath: "none",
      lightheadedness: "none",
      chestPain: false,
    };

    persistCheckIn(entry);
    setCurrentResult(result);
    setMode("result");
    resetForm();
  }

  function handleSubmitSymptoms() {
    const result = evaluateCheckIn({
      palpitations,
      shortnessOfBreath,
      lightheadedness,
      chestPain,
    });

    const entry: StoredCheckIn = {
      created_at: new Date().toISOString(),
      result: result.level,
      title: result.title,
      message: result.message,
      summary: result.summary,
      palpitations,
      shortnessOfBreath,
      lightheadedness,
      chestPain,
    };

    persistCheckIn(entry);
    setCurrentResult(result);
    setMode("result");
  }

  function resetSession() {
    resetForm();
    setMode("start");
    setCurrentResult(null);
    setShowHistory(false);
  }

  const patientCodes = Object.keys(profiles).sort();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 text-neutral-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-neutral-500">AF Recovery Check-In</p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight">
                How are you feeling today?
              </h1>
              {hasProfile ? (
                <>
                  <p className="mt-3 text-lg font-medium">
                    Study Code • {profile.studyCode}
                  </p>
                  <p className="mt-1 text-neutral-600">
                    Post-ablation • Week {profile.weeksSinceAblation}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-neutral-600">
                  Add a de-identified study code and weeks since ablation to
                  begin.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                className="rounded-2xl border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
                onClick={() => setShowProfileEditor((v) => !v)}
              >
                {showProfileEditor
                  ? "Close"
                  : hasProfile
                    ? "Edit / Add Patient"
                    : "Set Up Patient"}
              </button>
              <button
                className="rounded-2xl border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
                onClick={resetSession}
              >
                Reset View
              </button>
            </div>
          </div>

          {patientCodes.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium text-neutral-600">
                Current patient
              </div>
              <select
                value={currentCode}
                onChange={(e) => switchPatient(e.target.value)}
                className="w-full max-w-sm rounded-xl border border-neutral-300 px-3 py-2"
              >
                <option value="">Select patient</option>
                {patientCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showProfileEditor && (
            <div className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 p-4 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-neutral-600">
                  Study / Patient Code
                </div>
                <input
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="e.g. PT-1001"
                  value={profile.studyCode}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      studyCode: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-neutral-600">
                  Weeks Since Ablation
                </div>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2"
                  placeholder="e.g. 3"
                  value={profile.weeksSinceAblation}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      weeksSinceAblation:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                />
              </label>

              <div className="md:col-span-2">
                <button
                  className="rounded-2xl bg-black px-4 py-2 font-medium text-white"
                  onClick={saveCurrentProfile}
                >
                  Save Patient
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">Last 7 Days</div>
              <div className="mt-2 text-3xl font-semibold">{last7DaysCount}</div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">Yellow / Red</div>
              <div className="mt-2 text-3xl font-semibold">
                {yellowCount}/{redCount}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <div className="text-sm text-neutral-500">Trend</div>
              <div className="mt-2 text-xl font-semibold">{trendText}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <div className="text-sm text-neutral-500">Last check-in</div>
            {lastCheckIn ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${levelDot(
                      lastCheckIn.result
                    )}`}
                  />
                  <span className="capitalize">{lastCheckIn.result}</span>
                  <span className="text-neutral-500">•</span>
                  <span>{formatDateTime(lastCheckIn.created_at)}</span>
                </div>
                <div className="text-neutral-700">{lastCheckIn.summary}</div>
              </div>
            ) : (
              <div className="mt-2 text-neutral-700">No prior check-ins yet</div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-2xl border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "Hide Check-In History" : "View Check-In History"}
            </button>
          </div>

          {showHistory && (
            <div className="mt-6 space-y-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-lg font-semibold">Recent Check-Ins</h2>

              {checkIns.length === 0 ? (
                <p className="text-neutral-600">No check-ins yet.</p>
              ) : (
                <div className="space-y-3">
                  {checkIns.map((entry, idx) => (
                    <div
                      key={`${entry.created_at}-${idx}`}
                      className={`rounded-2xl border p-4 ${levelStyles(
                        entry.result
                      )}`}
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 font-semibold">
                          <span
                            className={`inline-block h-3 w-3 rounded-full ${levelDot(
                              entry.result
                            )}`}
                          />
                          <span>{entry.title}</span>
                        </div>
                        <div className="text-sm opacity-80">
                          {formatDateTime(entry.created_at)}
                        </div>
                      </div>

                      <div className="mt-2 text-sm">{entry.message}</div>
                      <div className="mt-2 text-sm font-medium">
                        {entry.summary}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            This prototype is de-identified and not connected to a medical
            record. It is for symptom tracking and workflow demonstration only.
          </div>
        </section>

        {mode === "start" && (
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <button
                className="w-full rounded-2xl bg-black px-4 py-5 text-lg font-semibold text-white disabled:opacity-50"
                onClick={handleNoSymptoms}
                disabled={!hasProfile}
              >
                No symptoms today
              </button>

              <button
                className="w-full rounded-2xl border border-neutral-300 px-4 py-5 text-lg font-semibold disabled:opacity-50"
                onClick={() => setMode("form")}
                disabled={!hasProfile}
              >
                I have symptoms
              </button>
            </div>
          </section>
        )}

        {mode === "form" && (
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">
                  Tell us about your symptoms
                </h2>
                <p className="mt-1 text-neutral-600">
                  Select the choices that best match how you feel right now.
                </p>
              </div>

              <div>
                <p className="mb-3 font-medium">Palpitations</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <ToggleButton
                    active={palpitations === "none"}
                    label="None"
                    onClick={() => setPalpitations("none")}
                  />
                  <ToggleButton
                    active={palpitations === "mild"}
                    label="Mild"
                    onClick={() => setPalpitations("mild")}
                  />
                  <ToggleButton
                    active={palpitations === "moderate"}
                    label="Moderate"
                    onClick={() => setPalpitations("moderate")}
                  />
                  <ToggleButton
                    active={palpitations === "severe"}
                    label="Severe"
                    onClick={() => setPalpitations("severe")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 font-medium">Shortness of breath</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ToggleButton
                    active={shortnessOfBreath === "none"}
                    label="None"
                    onClick={() => setShortnessOfBreath("none")}
                  />
                  <ToggleButton
                    active={shortnessOfBreath === "exertion"}
                    label="With activity"
                    onClick={() => setShortnessOfBreath("exertion")}
                  />
                  <ToggleButton
                    active={shortnessOfBreath === "rest"}
                    label="At rest"
                    onClick={() => setShortnessOfBreath("rest")}
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 font-medium">Lightheadedness</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <ToggleButton
                    active={lightheadedness === "none"}
                    label="None"
                    onClick={() => setLightheadedness("none")}
                  />
                  <ToggleButton
                    active={lightheadedness === "lightheaded"}
                    label="Lightheaded"
                    onClick={() => setLightheadedness("lightheaded")}
                  />
                  <ToggleButton
                    active={lightheadedness === "near_syncope"}
                    label="Near fainting"
                    onClick={() => setLightheadedness("near_syncope")}
                  />
                  <ToggleButton
                    active={lightheadedness === "syncope"}
                    label="Passed out"
                    onClick={() => setLightheadedness("syncope")}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
                <input
                  type="checkbox"
                  checked={chestPain}
                  onChange={(e) => setChestPain(e.target.checked)}
                  className="h-5 w-5"
                />
                <span className="font-medium">Chest pain or pressure</span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="w-full rounded-2xl border border-neutral-300 px-4 py-4 font-semibold"
                  onClick={() => {
                    resetForm();
                    setMode("start");
                  }}
                >
                  Back
                </button>

                <button
                  className="w-full rounded-2xl bg-black px-4 py-4 font-semibold text-white"
                  onClick={handleSubmitSymptoms}
                >
                  Continue
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === "result" && currentResult && (
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div
              className={`rounded-2xl border p-6 ${levelStyles(
                currentResult.level
              )}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block h-4 w-4 rounded-full ${levelDot(
                    currentResult.level
                  )}`}
                />
                <h2 className="text-2xl font-semibold">{currentResult.title}</h2>
              </div>

              <p className="mt-3 text-lg">{currentResult.message}</p>

              <div className="mt-4 rounded-xl bg-white/60 p-4 text-sm">
                <div className="font-medium text-neutral-700">Summary</div>
                <div className="mt-1">{currentResult.summary}</div>
              </div>
            </div>

            {currentResult.level === "red" && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Call 911 for severe, worsening, or emergency symptoms.
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="w-full rounded-2xl border border-neutral-300 px-4 py-4 font-semibold"
                onClick={() => {
                  resetForm();
                  setCurrentResult(null);
                  setMode("start");
                }}
              >
                Done
              </button>

              <button
                className="w-full rounded-2xl bg-black px-4 py-4 font-semibold text-white"
                onClick={() => {
                  resetForm();
                  setCurrentResult(null);
                  setMode("form");
                }}
              >
                Enter Another Check-In
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}