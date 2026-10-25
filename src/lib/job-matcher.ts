import { candidateProfile, type CandidateProfile } from "./candidate-profile";

export type MatchableJob = {
  title: string;
  location: string;
  workload: string;
  type: string;
  skills: string[];
  missing: string[];
};

export type MatchResult = {
  score: number;
  skillScore: number;
  workloadScore: number;
  locationScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;

  // New: confidence and transparency
  unknownFactors: string[];
  relatedSkills: string[];
};

// -----------------------------------------------------
// SKILL NORMALIZATION
// -----------------------------------------------------

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

// Different spellings referring to the same skill.
// Only include well-established naming equivalents.
const SKILL_ALIASES: Record<string, string> = {
  nodejs: "node.js",
  "node js": "node.js",
  "node.js": "node.js",

  reactjs: "react",
  "react.js": "react",
  react: "react",

  nextjs: "next.js",
  "next js": "next.js",
  "next.js": "next.js",

  typescript: "typescript",
  "type script": "typescript",

  javascript: "javascript",
  "java script": "javascript",

  postgres: "postgresql",
  postgresql: "postgresql",

  "ms sql": "mssql",
  "ms sql server": "mssql",
  "microsoft sql server": "mssql",
  "sql server": "mssql",
  mssql: "mssql",

  "ibm mq": "mq",
  "websphere mq": "mq",
  "ibm websphere mq": "mq",
  mq: "mq",

  "react native": "react native",
  "react-native": "react native",
};

function canonicalSkill(skill: string): string {
  const normalized = normalize(skill);
  return SKILL_ALIASES[normalized] ?? normalized;
}

// Related technologies are not necessarily equivalent.
// We flag them for review instead of silently matching.
const RELATED_SKILLS: Record<string, string[]> = {
  "unix/linux": ["unix", "linux"],
  unix: ["unix/linux", "linux"],
  linux: ["unix/linux", "unix"],

  java: ["j2ee", "spring", "spring boot"],
  j2ee: ["java", "spring"],

  mysql: ["sql", "postgresql", "mssql"],
  postgresql: ["sql", "mysql", "mssql"],
  mssql: ["sql", "postgresql", "mysql"],

  docker: ["kubernetes"],
  kubernetes: ["docker"],
};

function findRelatedSkill(
  requiredSkill: string,
  candidateSkills: Set<string>,
): string | null {
  const required = canonicalSkill(requiredSkill);
  const related = RELATED_SKILLS[required] ?? [];

  for (const skill of related) {
    const canonical = canonicalSkill(skill);

    if (candidateSkills.has(canonical)) {
      return skill;
    }
  }

  return null;
}

// -----------------------------------------------------
// SKILL MATCHING
// -----------------------------------------------------

function calculateSkills(job: MatchableJob, profile: CandidateProfile) {
  const requiredSkills = [
    ...new Map(
      [...job.skills, ...job.missing]
        .filter((skill) => skill.trim())
        .map((skill) => [canonicalSkill(skill), skill] as const),
    ).values(),
  ];

  const candidateSkills = new Set(profile.skills.map(canonicalSkill));

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const relatedSkills: string[] = [];

  for (const skill of requiredSkills) {
    const canonical = canonicalSkill(skill);

    if (candidateSkills.has(canonical)) {
      matchedSkills.push(skill);
      continue;
    }

    const related = findRelatedSkill(skill, candidateSkills);

    if (related) {
      relatedSkills.push(`${skill} (related: ${related})`);
    }

    missingSkills.push(skill);
  }

  const skillScore =
    requiredSkills.length === 0
      ? 0
      : (matchedSkills.length / requiredSkills.length) * 100;

  return {
    skillScore,
    matchedSkills,
    missingSkills,
    relatedSkills,
    hasSkillRequirements: requiredSkills.length > 0,
  };
}

// -----------------------------------------------------
// WORKLOAD MATCHING
// -----------------------------------------------------

function calculateWorkload(
  workload: string,
  profile: CandidateProfile,
): number | null {
  const percentages = [...workload.matchAll(/(\d{1,3})\s*%/g)].map((match) =>
    Number(match[1]),
  );

  if (percentages.length === 0) {
    return null;
  }

  const jobMin = Math.min(...percentages);
  const jobMax = Math.max(...percentages);

  const overlaps =
    jobMax >= profile.minimumWorkload && jobMin <= profile.maximumWorkload;

  return overlaps ? 100 : 0;
}

// -----------------------------------------------------
// LOCATION MATCHING
// -----------------------------------------------------

function calculateLocation(
  job: MatchableJob,
  profile: CandidateProfile,
): number | null {
  const location = normalize(job.location);
  const type = normalize(job.type);

  if (!location || location === "not specified" || location === "unknown") {
    // Explicit remote jobs may still match.
    if (
      type === "remote" &&
      profile.preferredLocations.some((place) => normalize(place) === "remote")
    ) {
      return 100;
    }

    return null;
  }

  if (
    type === "remote" &&
    profile.preferredLocations.some((place) => normalize(place) === "remote")
  ) {
    return 100;
  }

  const matches = profile.preferredLocations.some((preferredLocation) => {
    const preferred = normalize(preferredLocation);

    if (preferred === "remote") return false;

    if (
      preferred === "aargau" &&
      (location.includes("baden") ||
        location.includes("aarau") ||
        location.includes("aargau"))
    ) {
      return true;
    }

    return location.includes(preferred);
  });

  return matches ? 100 : 0;
}

// -----------------------------------------------------
// OVERALL MATCH
// -----------------------------------------------------

export function matchJob(
  job: MatchableJob,
  profile: CandidateProfile = candidateProfile,
): MatchResult {
  const {
    skillScore,
    matchedSkills,
    missingSkills,
    relatedSkills,
    hasSkillRequirements,
  } = calculateSkills(job, profile);

  const workload = calculateWorkload(job.workload, profile);

  const location = calculateLocation(job, profile);

  const unknownFactors: string[] = [];

  // Only include known factors in the weighted average.
  let weightedTotal = 0;
  let availableWeight = 0;

  if (hasSkillRequirements) {
    weightedTotal += skillScore * 0.75;
    availableWeight += 0.75;
  } else {
    unknownFactors.push("Skills");
  }

  if (workload !== null) {
    weightedTotal += workload * 0.15;
    availableWeight += 0.15;
  } else {
    unknownFactors.push("Workload");
  }

  if (location !== null) {
    weightedTotal += location * 0.1;
    availableWeight += 0.1;
  } else {
    unknownFactors.push("Location");
  }

  const score =
    availableWeight > 0 ? Math.round(weightedTotal / availableWeight) : 0;

  const explanationParts: string[] = [];

  if (matchedSkills.length > 0) {
    explanationParts.push(`Matching skills: ${matchedSkills.join(", ")}.`);
  }

  if (missingSkills.length > 0) {
    explanationParts.push(`Skills to verify: ${missingSkills.join(", ")}.`);
  }

  if (relatedSkills.length > 0) {
    explanationParts.push(
      `Related technologies detected: ${relatedSkills.join("; ")}. These are not automatically treated as equivalent.`,
    );
  }

  if (!hasSkillRequirements) {
    explanationParts.push("Required technical skills were not identified.");
  }

  if (workload === 100) {
    explanationParts.push("The workload matches your preferences.");
  } else if (workload === 0) {
    explanationParts.push(
      "The advertised workload does not overlap your preferred range.",
    );
  } else {
    explanationParts.push("Workload was not specified.");
  }

  if (location === 100) {
    explanationParts.push("The location matches your preferences.");
  } else if (location === 0) {
    explanationParts.push("The location does not match your saved locations.");
  } else {
    explanationParts.push("Location compatibility is unknown.");
  }

  if (unknownFactors.length > 0) {
    explanationParts.push(
      `Score excludes unknown factors: ${unknownFactors.join(", ")}.`,
    );
  }

  return {
    score,
    skillScore: Math.round(skillScore),
    workloadScore: workload ?? 0,
    locationScore: location ?? 0,
    matchedSkills,
    missingSkills,
    relatedSkills,
    unknownFactors,
    explanation: explanationParts.join(" "),
  };
}
