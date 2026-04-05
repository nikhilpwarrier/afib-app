export type Palpitations = "none" | "mild" | "moderate" | "severe";
export type ShortnessOfBreath = "none" | "exertion" | "rest";
export type Lightheadedness =
  | "none"
  | "lightheaded"
  | "near_syncope"
  | "syncope";

export type CheckInInput = {
  palpitations: Palpitations;
  shortnessOfBreath: ShortnessOfBreath;
  lightheadedness: Lightheadedness;
  chestPain: boolean;
};

export type CheckInResult = {
  level: "green" | "yellow" | "red";
  title: string;
  message: string;
  summary: string;
};

export function evaluateCheckIn(input: CheckInInput): CheckInResult {
  const { palpitations, shortnessOfBreath, lightheadedness, chestPain } = input;

  const red =
    chestPain ||
    lightheadedness === "syncope" ||
    (shortnessOfBreath === "rest" &&
      (palpitations === "moderate" || palpitations === "severe"));

  if (red) {
    return {
      level: "red",
      title: "Please seek urgent care",
      message:
        "These symptoms need urgent attention. Please contact your care team or seek immediate medical care.",
      summary: buildSummary(input),
    };
  }

  const yellow =
    palpitations === "moderate" ||
    palpitations === "severe" ||
    shortnessOfBreath === "exertion" ||
    lightheadedness === "lightheaded" ||
    lightheadedness === "near_syncope";

  if (yellow) {
    return {
      level: "yellow",
      title: "Follow-up recommended",
      message:
        "Your symptoms should be reviewed. Our team may follow up with you.",
      summary: buildSummary(input),
    };
  }

  return {
    level: "green",
    title: "Everything looks stable today",
    message: "No concerning symptoms were reported today.",
    summary: buildSummary(input),
  };
}

export function buildSummary(input: CheckInInput): string {
  const parts: string[] = [];

  if (input.palpitations !== "none") {
    parts.push(
      `Palpitations (${labelPalpitations(input.palpitations).toLowerCase()})`
    );
  }

  if (input.shortnessOfBreath !== "none") {
    parts.push(
      `Shortness of breath (${labelShortnessOfBreath(
        input.shortnessOfBreath
      ).toLowerCase()})`
    );
  }

  if (input.lightheadedness !== "none") {
    parts.push(
      `Lightheadedness (${labelLightheadedness(
        input.lightheadedness
      ).toLowerCase()})`
    );
  }

  if (input.chestPain) {
    parts.push("Chest pain");
  }

  return parts.length ? parts.join(", ") : "No symptoms";
}

export function labelPalpitations(value: Palpitations): string {
  switch (value) {
    case "mild":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
    default:
      return "None";
  }
}

export function labelShortnessOfBreath(value: ShortnessOfBreath): string {
  switch (value) {
    case "exertion":
      return "With activity";
    case "rest":
      return "At rest";
    default:
      return "None";
  }
}

export function labelLightheadedness(value: Lightheadedness): string {
  switch (value) {
    case "lightheaded":
      return "Lightheaded";
    case "near_syncope":
      return "Near fainting";
    case "syncope":
      return "Passed out";
    default:
      return "None";
  }
}