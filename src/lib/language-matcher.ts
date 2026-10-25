import type { CandidateProfile } from "./candidate-profile";

export type LanguageStatus = "met" | "not-met" | "verify";

export type LanguageCheck = {
  requirement: string;
  language: string;
  status: LanguageStatus;
  explanation: string;
  required: boolean;
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function findLevel(text: string): string | null {
  const match = text.toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return match?.[1] ?? null;
}

function levelRank(level: string): number {
  return CEFR_LEVELS.indexOf(level as (typeof CEFR_LEVELS)[number]);
}

function detectLanguage(text: string): string | null {
  const knownLanguages = [
    "English",
    "German",
    "French",
    "Italian",
    "Kannada",
    "Hindi",
  ];

  return (
    knownLanguages.find((name) =>
      new RegExp(`\\b${name}\\b`, "i").test(text),
    ) ?? null
  );
}

function checkLanguage(
  requirement: string,
  profile: CandidateProfile,
  required: boolean,
): LanguageCheck {
  const language = detectLanguage(requirement);

  const base = {
    requirement,
    language: language ?? "Unrecognised language",
    required,
  };

  if (!language) {
    return {
      ...base,
      status: "verify",
      explanation: "Language could not be identified automatically.",
    };
  }

  const candidate = profile.languages.find(
    (item) => item.name.toLowerCase() === language.toLowerCase(),
  );

  if (!candidate) {
    return {
      ...base,
      status: "verify",
      explanation: `${language} proficiency is not recorded in your profile.`,
    };
  }

  const requiredLevel = findLevel(requirement);
  const candidateLevel = findLevel(candidate.level);

  if (requiredLevel && candidateLevel) {
    const meets = levelRank(candidateLevel) >= levelRank(requiredLevel);

    return {
      ...base,
      status: meets ? "met" : "not-met",
      explanation: meets
        ? `Your ${candidateLevel} meets the stated ${requiredLevel} requirement.`
        : `The posting requests ${requiredLevel}, but your recorded level is ${candidateLevel}.`,
    };
  }

  if (/\b(native|mother tongue)\b/i.test(candidate.level)) {
    return {
      ...base,
      status: "met",
      explanation: `Your profile records native ${language} proficiency.`,
    };
  }

  if (
    /\b(fluent)\b/i.test(requirement) &&
    /\b(fluent)\b/i.test(candidate.level)
  ) {
    return {
      ...base,
      status: "met",
      explanation: `Your profile records fluent ${language}, matching the stated requirement.`,
    };
  }

  if (requiredLevel && !candidateLevel) {
    return {
      ...base,
      status: "verify",
      explanation: `The posting specifies ${requiredLevel}, but your profile does not record a comparable CEFR level.`,
    };
  }

  return {
    ...base,
    status: "verify",
    explanation: `Your profile records "${candidate.level}". Check whether this satisfies "${requirement}".`,
  };
}

export function assessLanguages(
  requiredLanguages: string[],
  preferredLanguages: string[],
  profile: CandidateProfile,
): LanguageCheck[] {
  return [
    ...requiredLanguages.map((requirement) =>
      checkLanguage(requirement, profile, true),
    ),
    ...preferredLanguages.map((requirement) =>
      checkLanguage(requirement, profile, false),
    ),
  ];
}

export function calculateAssessmentCoverage(values: {
  hasSkills: boolean;
  hasWorkload: boolean;
  hasLocation: boolean;
  hasLanguageInformation: boolean;
}) {
  const categories = [
    ["Required skills", values.hasSkills],
    ["Workload", values.hasWorkload],
    ["Location", values.hasLocation],
    ["Languages", values.hasLanguageInformation],
  ] as const;

  const assessed = categories.filter(([, available]) => available).length;

  return {
    percentage: Math.round((assessed / categories.length) * 100),
    available: categories
      .filter(([, available]) => available)
      .map(([name]) => name),
    unknown: categories
      .filter(([, available]) => !available)
      .map(([name]) => name),
  };
}
