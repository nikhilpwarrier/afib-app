export type PatientProfile = {
  studyCode: string;
  weeksSinceAblation: number | "";
};

export type StoredCheckIn = {
  created_at: string;
  result: "green" | "yellow" | "red";
  title: string;
  message: string;
  summary: string;
  palpitations: "none" | "mild" | "moderate" | "severe";
  shortnessOfBreath: "none" | "exertion" | "rest";
  lightheadedness: "none" | "lightheaded" | "near_syncope" | "syncope";
  chestPain: boolean;
};

export type ProfilesByPatient = Record<string, PatientProfile>;
export type CheckInsByPatient = Record<string, StoredCheckIn[]>;

export const PROFILES_KEY = "afib_profiles_by_patient_v1";
export const CHECKINS_KEY = "afib_checkins_by_patient_v1";
export const CURRENT_PATIENT_KEY = "afib_current_patient_v1";
export const DASHBOARD_STATUS_KEY = "afib_dashboard_status_v1";

export function loadProfiles(): ProfilesByPatient {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: ProfilesByPatient) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function loadCheckInsByPatient(): CheckInsByPatient {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHECKINS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCheckInsByPatient(checkIns: CheckInsByPatient) {
  localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkIns));
}

export function loadCurrentPatientCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CURRENT_PATIENT_KEY) || "";
}

export function saveCurrentPatientCode(studyCode: string) {
  localStorage.setItem(CURRENT_PATIENT_KEY, studyCode);
}

export function upsertProfile(profile: PatientProfile) {
  const profiles = loadProfiles();
  profiles[profile.studyCode] = profile;
  saveProfiles(profiles);
}

export function getProfile(studyCode: string): PatientProfile | null {
  const profiles = loadProfiles();
  return profiles[studyCode] || null;
}

export function getPatientCheckIns(studyCode: string): StoredCheckIn[] {
  const all = loadCheckInsByPatient();
  const rows = all[studyCode] || [];
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function addPatientCheckIn(studyCode: string, entry: StoredCheckIn) {
  const all = loadCheckInsByPatient();
  const existing = all[studyCode] || [];
  all[studyCode] = [entry, ...existing].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  saveCheckInsByPatient(all);
}

export function getAllPatients() {
  const profiles = loadProfiles();
  const checkInsByPatient = loadCheckInsByPatient();

  const codes = new Set([
    ...Object.keys(profiles),
    ...Object.keys(checkInsByPatient),
  ]);

  return Array.from(codes).map((studyCode) => ({
    studyCode,
    profile: profiles[studyCode] || { studyCode, weeksSinceAblation: "" },
    checkIns: [...(checkInsByPatient[studyCode] || [])].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  }));
}