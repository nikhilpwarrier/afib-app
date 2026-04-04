"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CheckinLite = {
  id: string;
  created_at: string;
  result: string | null;
  patient_ablation_date: string | null;
  would_have_gone_to_ed: boolean | null;
};

function ensurePatientId() {
  const existing = localStorage.getItem("patientId");
  if (existing && existing !== "undefined" && existing !== "null") {
    return existing;
  }

  const newId = crypto.randomUUID();
  localStorage.setItem("patientId", newId);
  return newId;
}

function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function Home() {
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [patientAblationDate, setPatientAblationDate] = useState("");
  const [baselineSymptomBurden, setBaselineSymptomBurden] = useState(5);
  const [patientId, setPatientId] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  const [palpitations, setPalpitations] = useState("none");
  const [duration, setDuration] = useState("<5");
  const [chestPain, setChestPain] = useState(false);
  const [dyspnea, setDyspnea] = useState("none");
  const [lightheadedness, setLightheadedness] = useState("none");

  const [fatigue, setFatigue] = useState("none");
  const [functionalImpact, setFunctionalImpact] = useState("none");
  const [trigger, setTrigger] = useState("rest");
  const [wantsCareTeamContact, setWantsCareTeamContact] = useState(false);
  const [wouldHaveGoneToEd, setWouldHaveGoneToEd] = useState(false);

  const [historyRows, setHistoryRows] = useState<CheckinLite[]>([]);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const id = ensurePatientId();
    setPatientId(id);

    const savedName = localStorage.getItem("patientName");
    const savedEmail = localStorage.getItem("patientEmail");
    const savedDob = localStorage.getItem("patientDob");
    const savedAblationDate = localStorage.getItem("patientAblationDate");
    const savedBaseline = localStorage.getItem("baselineSymptomBurden");

    if (savedName && savedEmail && savedDob) {
      setPatientName(savedName);
      setPatientEmail(savedEmail);
      setPatientDob(savedDob);
      setPatientAblationDate(savedAblationDate || "");
      setBaselineSymptomBurden(savedBaseline ? Number(savedBaseline) : 5);
      setProfileSaved(true);
    }
  }, []);

  useEffect(() => {
    if (profileSaved && patientId) {
      fetchPatientHistory(patientId);
    }
  }, [profileSaved, patientId]);

  async function fetchPatientHistory(currentPatientId: string) {
    setHistoryError("");

    try {
      const res = await fetch(
        `/api/history?patient_id=${encodeURIComponent(currentPatientId)}`
      );
      const json = await res.json();

      if (!res.ok) {
        setHistoryError(json.error || "Unable to load history.");
        return;
      }

      setHistoryRows((json.data as CheckinLite[]) || []);
    } catch {
      setHistoryError("Unable to load history.");
    }
  }

  function saveProfile() {
    if (!patientName || !patientEmail || !patientDob) {
      alert("Please enter name, email, and date of birth");
      return;
    }

    const id = ensurePatientId();
    setPatientId(id);

    localStorage.setItem("patientName", patientName);
    localStorage.setItem("patientEmail", patientEmail);
    localStorage.setItem("patientDob", patientDob);
    localStorage.setItem("patientAblationDate", patientAblationDate);
    localStorage.setItem(
      "baselineSymptomBurden",
      String(baselineSymptomBurden || 5)
    );

    setProfileSaved(true);
  }

  function getPhase(ablationDate: string) {
    if (!ablationDate) return "general";

    const ablation = parseLocalDate(ablationDate);
    const today = new Date();

    ablation.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (ablation.getTime() > today.getTime()) return "pre-ablation";
    return "post-ablation";
  }

  function getWeekNumber(ablationDate: string) {
    if (!ablationDate) return null;

    const ablation = parseLocalDate(ablationDate);
    const today = new Date();

    ablation.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - ablation.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 0;
    return Math.floor(diffDays / 7) + 1;
  }

  const trendSummary = useMemo(() => {
    const now = new Date();

    const last7 = historyRows.filter((row) => {
      const d = new Date(row.created_at);
      return now.getTime() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const previous7 = historyRows.filter((row) => {
      const d = new Date(row.created_at);
      const diff = now.getTime() - d.getTime();
      return diff > 7 * 24 * 60 * 60 * 1000 && diff <= 14 * 24 * 60 * 60 * 1000;
    }).length;

    const redCount = historyRows.filter((r) => r.result?.includes("🔴")).length;
    const yellowCount = historyRows.filter((r) => r.result?.includes("🟡")).length;
    const edDiversionCount = historyRows.filter(
      (r) => r.would_have_gone_to_ed === true
    ).length;

    let trendMessage = "No clear trend yet";
    if (last7 >= 3) {
      trendMessage = "Frequent episodes this week";
    } else if (last7 > previous7) {
      trendMessage = "Symptoms increasing";
    } else if (last7 < previous7 && previous7 > 0) {
      trendMessage = "Symptoms improving";
    } else if (last7 > 0 && last7 === previous7) {
      trendMessage = "Symptoms stable";
    }

    const needsAttention =
      last7 >= 3 || redCount > 0 || yellowCount > 0 || edDiversionCount > 0;

    return {
      last7,
      redCount,
      yellowCount,
      trendMessage,
      needsAttention,
    };
  }, [historyRows]);

  const lastCheckinText = useMemo(() => {
    if (historyRows.length === 0) return "No prior check-ins yet";
    const latest = historyRows[0];
    return `${new Date(latest.created_at).toLocaleString()} • ${
      latest.result || "No result"
    }`;
  }, [historyRows]);

  async function saveCheckin(finalResult: string) {
    setSaving(true);

    const currentPatientId = ensurePatientId();
    setPatientId(currentPatientId);

    const phase = getPhase(patientAblationDate);
    const weekNumber = getWeekNumber(patientAblationDate);

    const { error } = await supabase.from("checkins").insert({
      patient_id: currentPatientId,
      patient_name: patientName,
      patient_email: patientEmail,
      patient_dob: patientDob,
      patient_ablation_date: patientAblationDate || null,
      baseline_symptom_burden: baselineSymptomBurden,
      phase,
      week_number: weekNumber,
      palpitations,
      duration,
      chest_pain: chestPain,
      dyspnea,
      lightheadedness,
      fatigue,
      functional_impact: functionalImpact,
      trigger,
      wants_care_team_contact: wantsCareTeamContact,
      would_have_gone_to_ed: wouldHaveGoneToEd,
      result: finalResult,
    });

    setSaving(false);

    if (error) {
      alert("Error saving check-in: " + error.message);
      return false;
    }

    await fetchPatientHistory(currentPatientId);
    return true;
  }

  async function handleNoSymptoms() {
    const finalResult = "🟢 No symptoms reported";
    const ok = await saveCheckin(finalResult);
    if (ok) {
      setResult(finalResult);
      setStep(1);
    }
  }

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();

    if (chestPain || dyspnea === "rest" || lightheadedness === "syncope") {
      const finalResult = "🔴 High Risk: Seek urgent medical care";
      const ok = await saveCheckin(finalResult);
      if (ok) {
        setResult(finalResult);
        setStep(1);
      }
      return;
    }

    const noSymptoms =
      palpitations === "none" &&
      dyspnea === "none" &&
      lightheadedness === "none" &&
      !chestPain;

    if (noSymptoms) {
      const finalResult = "🟢 Low Risk: Monitor symptoms";
      const ok = await saveCheckin(finalResult);
      if (ok) {
        setResult(finalResult);
        setStep(1);
      }
      return;
    }

    setResult("");
    setStep(2);
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();

    let finalResult = "🟢 Low Risk: Monitor symptoms";

    if (
      palpitations === "severe" ||
      duration === ">30" ||
      duration === "continuous" ||
      fatigue === "severe" ||
      dyspnea === "exertion" ||
      lightheadedness === "near-syncope" ||
      functionalImpact === "unable"
    ) {
      finalResult = "🟡 Moderate Risk: Needs follow-up";
    }

    if (wantsCareTeamContact && !finalResult.includes("🔴")) {
      finalResult = "🟡 Moderate Risk: Care team follow-up requested";
    }

    const ok = await saveCheckin(finalResult);
    if (ok) {
      setResult(finalResult);
      setStep(1);
    }
  }

  function resetForm() {
    setStep(1);
    setResult("");
    setPalpitations("none");
    setDuration("<5");
    setChestPain(false);
    setDyspnea("none");
    setLightheadedness("none");
    setFatigue("none");
    setFunctionalImpact("none");
    setTrigger("rest");
    setWantsCareTeamContact(false);
    setWouldHaveGoneToEd(false);
  }

  function editProfile() {
    setProfileSaved(false);
    setResult("");
    setStep(1);
  }

  function clearProfile() {
    localStorage.removeItem("patientName");
    localStorage.removeItem("patientEmail");
    localStorage.removeItem("patientDob");
    localStorage.removeItem("patientAblationDate");
    localStorage.removeItem("baselineSymptomBurden");
    localStorage.removeItem("patientId");

    setPatientName("");
    setPatientEmail("");
    setPatientDob("");
    setPatientAblationDate("");
    setBaselineSymptomBurden(5);
    setPatientId("");
    setProfileSaved(false);
    setResult("");
    setStep(1);
    setHistoryRows([]);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-black md:p-8">
      <div className="mx-auto max-w-3xl">
        {!profileSaved ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-500">
                AF Monitoring
              </div>
              <h1 className="mt-1 text-3xl font-semibold">Patient setup</h1>
              <p className="mt-2 text-sm text-gray-600">
                Enter your information once to start symptom check-ins.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name">
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                />
              </Field>

              <Field label="Date of Birth">
                <input
                  type="date"
                  value={patientDob}
                  onChange={(e) => setPatientDob(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                />
              </Field>

              <Field label="Ablation Date (optional)">
                <input
                  type="date"
                  value={patientAblationDate}
                  onChange={(e) => setPatientAblationDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Baseline Symptom Burden (0–10)">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={baselineSymptomBurden}
                  onChange={(e) =>
                    setBaselineSymptomBurden(Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                />
              </Field>
            </div>

            <button
              onClick={saveProfile}
              className="mt-6 w-full rounded-2xl bg-black px-4 py-3 font-medium text-white"
            >
              Save and Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    AF Monitoring
                  </div>
                  <h1 className="mt-1 text-3xl font-semibold">
                    How are you feeling today?
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    {patientName} • {patientEmail}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {patientAblationDate
                      ? `${getPhase(patientAblationDate)} • week ${getWeekNumber(
                          patientAblationDate
                        ) ?? "-"}`
                      : "general AF monitoring"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={editProfile}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={clearProfile}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard label="Last 7 Days" value={String(trendSummary.last7)} />
                <MetricCard
                  label="Yellow / Red"
                  value={`${trendSummary.yellowCount}/${trendSummary.redCount}`}
                />
                <MetricCard label="Trend" value={trendSummary.trendMessage} />
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-500">
                  Last check-in
                </div>
                <div className="mt-1 text-sm text-gray-800">{lastCheckinText}</div>
                {historyError && (
                  <div className="mt-2 text-sm text-red-600">{historyError}</div>
                )}
              </div>

              {trendSummary.needsAttention && (
                <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm">
                  <strong>Attention:</strong> recent pattern suggests follow-up
                  may be needed.
                </div>
              )}

              <div className="mt-5">
                <a
                  href="/history"
                  className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium"
                >
                  View Check-In History
                </a>
              </div>
            </div>

            {!result && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                {step === 1 && (
                  <>
                    <button
                      onClick={handleNoSymptoms}
                      disabled={saving}
                      className="mb-6 w-full rounded-2xl bg-black px-4 py-4 text-lg font-semibold text-white"
                    >
                      {saving ? "Saving..." : "No symptoms today"}
                    </button>

                    <div className="mb-5 text-sm text-gray-500">
                      Or tell us about your current symptoms
                    </div>

                    <form className="space-y-5" onSubmit={handleStep1Submit}>
                      <ChoiceGroup
                        label="Palpitations"
                        value={palpitations}
                        onChange={setPalpitations}
                        options={[
                          { label: "None", value: "none" },
                          { label: "Mild", value: "mild" },
                          { label: "Moderate", value: "moderate" },
                          { label: "Severe", value: "severe" },
                        ]}
                      />

                      {palpitations !== "none" && (
                        <ChoiceGroup
                          label="Duration"
                          value={duration}
                          onChange={setDuration}
                          options={[
                            { label: "<5 min", value: "<5" },
                            { label: "5–30 min", value: "5-30" },
                            { label: ">30 min", value: ">30" },
                            { label: "Continuous", value: "continuous" },
                          ]}
                        />
                      )}

                      <ChoiceGroup
                        label="Shortness of breath"
                        value={dyspnea}
                        onChange={setDyspnea}
                        options={[
                          { label: "None", value: "none" },
                          { label: "With exertion", value: "exertion" },
                          { label: "At rest", value: "rest" },
                        ]}
                      />

                      <ChoiceGroup
                        label="Lightheadedness"
                        value={lightheadedness}
                        onChange={setLightheadedness}
                        options={[
                          { label: "None", value: "none" },
                          { label: "Lightheaded", value: "lightheaded" },
                          { label: "Near-syncope", value: "near-syncope" },
                          { label: "Syncope", value: "syncope" },
                        ]}
                      />

                      <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                        <input
                          type="checkbox"
                          checked={chestPain}
                          onChange={(e) => setChestPain(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">
                          Chest pain / chest pressure
                        </span>
                      </label>

                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-black px-4 py-3 font-medium text-white"
                      >
                        Continue
                      </button>
                    </form>
                  </>
                )}

                {step === 2 && (
                  <form className="space-y-5" onSubmit={handleStep2Submit}>
                    <ChoiceGroup
                      label="Fatigue / reduced energy"
                      value={fatigue}
                      onChange={setFatigue}
                      options={[
                        { label: "None", value: "none" },
                        { label: "Mild", value: "mild" },
                        { label: "Moderate", value: "moderate" },
                        { label: "Severe", value: "severe" },
                      ]}
                    />

                    <ChoiceGroup
                      label="Functional impact"
                      value={functionalImpact}
                      onChange={setFunctionalImpact}
                      options={[
                        { label: "None", value: "none" },
                        { label: "Mild", value: "mild" },
                        { label: "Moderate", value: "moderate" },
                        { label: "Unable", value: "unable" },
                      ]}
                    />

                    <ChoiceGroup
                      label="Trigger / context"
                      value={trigger}
                      onChange={setTrigger}
                      options={[
                        { label: "At rest", value: "rest" },
                        { label: "With exertion", value: "exertion" },
                        { label: "Alcohol", value: "alcohol" },
                        { label: "Caffeine", value: "caffeine" },
                        { label: "Illness", value: "illness" },
                        { label: "Post-procedure", value: "post-procedure" },
                      ]}
                    />

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                        <input
                          type="checkbox"
                          checked={wantsCareTeamContact}
                          onChange={(e) =>
                            setWantsCareTeamContact(e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">
                          Please have the care team contact me
                        </span>
                      </label>

                      <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
                        <input
                          type="checkbox"
                          checked={wouldHaveGoneToEd}
                          onChange={(e) => setWouldHaveGoneToEd(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">
                          Without this app, I would have gone to the ED
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-1/2 rounded-2xl border border-gray-300 px-4 py-3 font-medium"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-1/2 rounded-2xl bg-black px-4 py-3 font-medium text-white"
                      >
                        {saving ? "Saving..." : "Submit"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {result && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
                  <div className="text-lg font-semibold">{result}</div>
                </div>

                {(result.includes("🔴") ||
                  result.includes("🟡") ||
                  trendSummary.last7 >= 3 ||
                  wantsCareTeamContact) && (
                  <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm">
                    Suggested next step: clinic follow-up and care team review.
                  </div>
                )}

                <button
                  onClick={resetForm}
                  className="mt-5 w-full rounded-2xl border border-gray-300 px-4 py-3 font-medium"
                >
                  Start New Check-In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                selected
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-800"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}