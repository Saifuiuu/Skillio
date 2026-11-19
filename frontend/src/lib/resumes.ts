import { ApiError, type ExtractionStatus, type ParseStatus } from "@/lib/api";

export const MAX_ACTIVE_RESUMES = 3;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_EXT = [".pdf", ".docx"] as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatResumeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function labelExtraction(status: ExtractionStatus): string {
  switch (status) {
    case "ok":
      return "Text extracted";
    case "empty":
      return "No text found";
    case "failed":
      return "Extraction failed";
    default:
      return status;
  }
}

export function extractionBadgeClass(status: ExtractionStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-50 text-emerald-800";
    case "empty":
      return "bg-amber-50 text-amber-900";
    case "failed":
      return "bg-red-50 text-red-800";
    default:
      return "bg-muted text-foreground/80";
  }
}

export function labelParseStatus(status: ParseStatus): string {
  switch (status) {
    case "not_parsed":
      return "Not analyzed";
    case "parsing":
      return "Analyzing...";
    case "ok":
      return "Analyzed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function parseStatusBadgeClass(status: ParseStatus): string {
  switch (status) {
    case "not_parsed":
      return "bg-muted text-muted-foreground border border-border";
    case "parsing":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20";
    case "ok":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
    case "failed":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

export function resumeUploadErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  switch (err.status) {
    case 400:
      return "Please upload a valid PDF or DOCX file.";
    case 413:
      return "File is too large (max 5 MB).";
    case 409:
      return "You already have 3 active CVs. Archive one first.";
    case 429:
      return "Too many uploads. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function validateResumeFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt = ALLOWED_RESUME_EXT.some((ext) => name.endsWith(ext));
  if (!okExt) return "Please upload a valid PDF or DOCX file.";
  if (file.size > MAX_RESUME_BYTES) return "File is too large (max 5 MB).";
  return null;
}

const SMALL_WORDS = new Set([
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "with",
  "by",
  "a",
  "an",
  "the",
  "as",
  "via",
]);

export const KNOWN_SKILL_MAP: Record<string, string> = {
  // Languages & Core
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  "c#": "C#",
  "c++": "C++",
  c: "C",
  ".net": ".NET",
  dotnet: ".NET",
  "asp.net core": "ASP.NET Core",
  "asp.net": "ASP.NET",
  php: "PHP",
  ruby: "Ruby",
  rust: "Rust",
  go: "Go",
  golang: "Go",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  r: "R",
  scala: "Scala",

  // Frameworks & Libraries
  "node.js": "Node.js",
  nodejs: "Node.js",
  "react.js": "React.js",
  reactjs: "React.js",
  react: "React",
  "next.js": "Next.js",
  nextjs: "Next.js",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  vue: "Vue",
  angular: "Angular",
  "express.js": "Express.js",
  expressjs: "Express.js",
  express: "Express",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  "spring boot": "Spring Boot",
  laravel: "Laravel",

  // Databases & Storage
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  sql: "SQL",
  nosql: "NoSQL",
  sqlite: "SQLite",
  redis: "Redis",
  supabase: "Supabase",
  firebase: "Firebase",

  // Tools, DevOps & Cloud
  github: "GitHub",
  gitlab: "GitLab",
  git: "Git",
  "vs code": "VS Code",
  vscode: "VS Code",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "K8s",
  linux: "Linux",
  postman: "Postman",
  "power bi": "Power BI",
  powerbi: "Power BI",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  "ci/cd": "CI/CD",
  ci: "CI",
  cd: "CD",

  // Web Standards & Protocols
  html: "HTML",
  html5: "HTML5",
  css: "CSS",
  css3: "CSS3",
  "tailwind css": "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  graphql: "GraphQL",
  "rest apis": "REST APIs",
  "rest api": "REST API",
  rest: "REST",
  api: "API",
  apis: "APIs",
  jwt: "JWT",
  oauth: "OAuth",
  json: "JSON",
  xml: "XML",
  yaml: "YAML",

  // Concepts & Architecture
  oop: "OOP",
  ai: "AI",
  ml: "ML",
  ui: "UI",
  ux: "UX",
  "ui/ux": "UI/UX",
  "machine learning basics": "Machine Learning Basics",
  "machine learning": "Machine Learning",
  "deep learning": "Deep Learning",
  "data structures and algorithms": "Data Structures and Algorithms",
  "data structures & algorithms": "Data Structures & Algorithms",
  dsa: "DSA",
  "role-based access control": "Role-Based Access Control",
  rbac: "RBAC",
  nlp: "NLP",
  seo: "SEO",
  qa: "QA",
};

export const KNOWN_ACRONYMS: Record<string, string> = {
  bs: "BS",
  ms: "MS",
  bsc: "BSc",
  msc: "MSc",
  ba: "BA",
  ma: "MA",
  bba: "BBA",
  mba: "MBA",
  phd: "PhD",
  be: "BE",
  me: "ME",
  btech: "BTech",
  mtech: "MTech",
  szabist: "SZABIST",
  nust: "NUST",
  fast: "FAST",
  lums: "LUMS",
  iba: "IBA",
  giki: "GIKI",
  ned: "NED",
  uit: "UIT",
  ku: "KU",
  it: "IT",
  ai: "AI",
  cs: "CS",
  se: "SE",
  ui: "UI",
  ux: "UX",
  api: "API",
  apis: "APIs",
  qa: "QA",
  hr: "HR",
  ceo: "CEO",
  cto: "CTO",
  cfo: "CFO",
  coo: "COO",
  vp: "VP",
  usa: "USA",
  uk: "UK",
  uae: "UAE",
  llc: "LLC",
  ltd: "Ltd",
  inc: "Inc",
  corp: "Corp",
  pvt: "Pvt",
  hsc: "HSC",
  ssc: "SSC",
};

export const MONTH_MAP: Record<string, string> = {
  january: "January",
  jan: "Jan",
  february: "February",
  feb: "Feb",
  march: "March",
  mar: "Mar",
  april: "April",
  apr: "Apr",
  may: "May",
  june: "June",
  jun: "Jun",
  july: "July",
  jul: "Jul",
  august: "August",
  aug: "Aug",
  september: "September",
  sep: "Sep",
  sept: "Sept",
  october: "October",
  oct: "Oct",
  november: "November",
  nov: "Nov",
  december: "December",
  dec: "Dec",
};

/**
 * Format a skill string with proper brand capitalization and known IT acronyms.
 * Falls back to intelligent title case for unknown skills while keeping small words lowercase.
 */
export function formatSkill(skill?: string | null): string {
  if (!skill || typeof skill !== "string") return "";
  const trimmed = skill.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (KNOWN_SKILL_MAP[lower]) {
    return KNOWN_SKILL_MAP[lower];
  }
  if (KNOWN_ACRONYMS[lower]) {
    return KNOWN_ACRONYMS[lower];
  }

  const words = trimmed.split(/\s+/);
  const formatted = words.map((word, index) => {
    const match = /^([^a-zA-Z0-9#+.]*)(.*?)([^a-zA-Z0-9#+.]*)$/.exec(word);
    if (!match) return word;
    const [, prefix, core, suffix] = match;
    if (!core) return word;

    const lowerCore = core.toLowerCase();
    if (KNOWN_SKILL_MAP[lowerCore]) {
      return `${prefix}${KNOWN_SKILL_MAP[lowerCore]}${suffix}`;
    }
    if (KNOWN_ACRONYMS[lowerCore]) {
      return `${prefix}${KNOWN_ACRONYMS[lowerCore]}${suffix}`;
    }
    if (index > 0 && SMALL_WORDS.has(lowerCore)) {
      return `${prefix}${lowerCore}${suffix}`;
    }

    if (core.includes("-")) {
      const parts = core.split("-").map((part, partIdx) => {
        const lowerPart = part.toLowerCase();
        if (KNOWN_SKILL_MAP[lowerPart]) return KNOWN_SKILL_MAP[lowerPart];
        if (KNOWN_ACRONYMS[lowerPart]) return KNOWN_ACRONYMS[lowerPart];
        if (partIdx > 0 && SMALL_WORDS.has(lowerPart)) return lowerPart;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      });
      return `${prefix}${parts.join("-")}${suffix}`;
    }

    return `${prefix}${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}${suffix}`;
  });

  return formatted.join(" ");
}

/**
 * Format free-text entries (e.g. job titles, company names, degrees, institutions).
 * Intelligently title cases sentences while preserving recognized acronyms and institutions (e.g. BS, MS, SZABIST).
 */
export function formatText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  const formatted = words.map((word, index) => {
    const match = /^([^a-zA-Z0-9#+.]*)(.*?)([^a-zA-Z0-9#+.]*)$/.exec(word);
    if (!match) return word;
    const [, prefix, core, suffix] = match;
    if (!core) return word;

    const lowerCore = core.toLowerCase();
    if (KNOWN_ACRONYMS[lowerCore]) {
      return `${prefix}${KNOWN_ACRONYMS[lowerCore]}${suffix}`;
    }
    if (KNOWN_SKILL_MAP[lowerCore]) {
      return `${prefix}${KNOWN_SKILL_MAP[lowerCore]}${suffix}`;
    }
    if (index > 0 && SMALL_WORDS.has(lowerCore)) {
      return `${prefix}${lowerCore}${suffix}`;
    }

    if (core.includes("-")) {
      const parts = core.split("-").map((part, partIdx) => {
        const lowerPart = part.toLowerCase();
        if (KNOWN_ACRONYMS[lowerPart]) return KNOWN_ACRONYMS[lowerPart];
        if (KNOWN_SKILL_MAP[lowerPart]) return KNOWN_SKILL_MAP[lowerPart];
        if (partIdx > 0 && SMALL_WORDS.has(lowerPart)) return lowerPart;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      });
      return `${prefix}${parts.join("-")}${suffix}`;
    }

    return `${prefix}${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}${suffix}`;
  });

  return formatted.join(" ");
}

/**
 * Format duration strings (e.g. "june 2026 to present" -> "June 2026 to Present").
 */
export function formatDurationText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  const formatted = words.map((w) => {
    const lowerClean = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (MONTH_MAP[lowerClean]) {
      return w.replace(new RegExp(lowerClean, "i"), MONTH_MAP[lowerClean]);
    }
    if (lowerClean === "present" || lowerClean === "current") {
      return w.replace(new RegExp(lowerClean, "i"), "Present");
    }
    if (lowerClean === "to" || lowerClean === "till" || lowerClean === "until") {
      return "to";
    }
    if (/^\d+$/.test(lowerClean)) {
      return w;
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return formatted.join(" ");
}
