export type CandidateProfile = {
  title: string;
  skills: string[];
  preferredLocations: string[];
  minimumWorkload: number;
  maximumWorkload: number;
  languages: {
    name: string;
    level: string;
  }[];
};

export const candidateProfile: CandidateProfile = {
  title: "Software Engineer",

  skills: [
    // Enterprise engineering
    "Java",
    "J2EE",
    "Spring",
    "Hibernate",
    "SQL",
    "Unix",
    "Shell",
    "Production Support",
    "Application Management",
    "MQ",
    "File Transfer",
    "Monitoring",
    "Incident Management",
    "Enterprise Integration",
    "Oracle",
    "MSSQL",

    // Modern web
    "React",
    "Next.js",
    "TypeScript",
    "JavaScript",
    "Tailwind CSS",
    "Node.js",
    "PostgreSQL",
    "Supabase",
    "Prisma",
    "REST APIs",

    // Mobile
    "React Native",
    "Expo",

    // Tools
    "Git",
    "GitHub",
    "Vercel",
    "Firebase",
    "Docker",
  ],

  preferredLocations: ["Aargau", "Zürich", "Baden", "Aarau", "Remote"],

  minimumWorkload: 40,
  maximumWorkload: 60,

  languages: [
    { name: "English", level: "Fluent" },
    { name: "German", level: "B1 Certified" },
    { name: "Kannada", level: "Native" },
  ],
};
