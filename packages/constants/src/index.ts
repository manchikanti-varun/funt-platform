
export enum ROLE {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  TRAINER = "TRAINER",
  STUDENT = "STUDENT",
  PARENT = "PARENT",
}

export enum ACCOUNT_STATUS {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  ARCHIVED = "ARCHIVED",
}

export enum MODULE_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum ASSIGNMENT_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum ENROLLMENT_STATUS {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  SUSPENDED = "SUSPENDED",
  DROPPED = "DROPPED",
}

export enum SUBMISSION_REVIEW_STATUS {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum COURSE_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  LAUNCHING_SOON = "LAUNCHING_SOON",
}

export enum BATCH_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum SUBMISSION_TYPE {
  FILE = "file",
  TEXT = "text",
  LINK = "link",
}

export enum SKILL_TAG {
  ELECTRONICS = "Electronics",
  MECHANICAL = "Mechanical",
  PROGRAMMING = "Programming",
  ALGORITHMS = "Algorithms",
  CREATIVITY = "Creativity",
  INNOVATION = "Innovation",
  WEB_DEVELOPMENT = "Web Development",
  MOBILE_DEVELOPMENT = "Mobile Development",
  DATA_SCIENCE = "Data Science",
  DEVOPS_CLOUD = "DevOps & Cloud",
  UI_UX = "UI / UX",
  COMMUNICATION = "Communication",
  HTML = "HTML",
  CSS = "CSS",
  JAVASCRIPT = "JavaScript",
  TYPESCRIPT = "TypeScript",
  REACT = "React",
  NODEJS = "Node.js",
  PYTHON = "Python",
  SQL = "SQL",
  GIT = "Git",
}

/** Curated groups for admin UI (preset tags). Custom labels may still be added up to 48 chars. */
export const SKILL_TAG_GROUPS: ReadonlyArray<{ label: string; tags: readonly SKILL_TAG[] }> = [
  {
    label: "Domains & tracks",
    tags: [
      SKILL_TAG.WEB_DEVELOPMENT,
      SKILL_TAG.MOBILE_DEVELOPMENT,
      SKILL_TAG.DATA_SCIENCE,
      SKILL_TAG.DEVOPS_CLOUD,
      SKILL_TAG.UI_UX,
    ],
  },
  {
    label: "Hardware & foundations",
    tags: [
      SKILL_TAG.ELECTRONICS,
      SKILL_TAG.MECHANICAL,
      SKILL_TAG.PROGRAMMING,
      SKILL_TAG.ALGORITHMS,
    ],
  },
  {
    label: "Web & software stack",
    tags: [
      SKILL_TAG.HTML,
      SKILL_TAG.CSS,
      SKILL_TAG.JAVASCRIPT,
      SKILL_TAG.TYPESCRIPT,
      SKILL_TAG.REACT,
      SKILL_TAG.NODEJS,
      SKILL_TAG.PYTHON,
      SKILL_TAG.SQL,
      SKILL_TAG.GIT,
    ],
  },
  {
    label: "Mindset & craft",
    tags: [SKILL_TAG.CREATIVITY, SKILL_TAG.INNOVATION, SKILL_TAG.COMMUNICATION],
  },
];

const PRESET_SKILL_TAG_SET = new Set(Object.values(SKILL_TAG));

/** Preset enum tags plus optional short custom labels (e.g. “Rust”, “Angular”). */
export function isValidSkillTag(tag: string): boolean {
  const t = tag.trim();
  if (!t) return false;
  if (PRESET_SKILL_TAG_SET.has(t as SKILL_TAG)) return true;
  if (t.length < 2 || t.length > 48) return false;
  return /^[A-Za-z0-9 +.#\-\/()][A-Za-z0-9 +.#\-\/()]{0,47}$/.test(t);
}

export enum ATTENDANCE_STATUS {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
}

export enum CERTIFICATE_STATUS {
  ISSUED = "ISSUED",
  REVOKED = "REVOKED",
}

export enum BADGE_TYPE {
  FIRST_ASSIGNMENT_SUBMITTED = "FIRST_ASSIGNMENT_SUBMITTED",
  SEVEN_DAY_STREAK = "SEVEN_DAY_STREAK",
  FIRST_COURSE_COMPLETED = "FIRST_COURSE_COMPLETED",
  PERFECT_ATTENDANCE_MONTH = "PERFECT_ATTENDANCE_MONTH",
}

/** Student rolling UPI QR refresh interval (seconds); must match backend rolling QR generation. */
export const ROLLING_UPI_QR_REFRESH_AFTER_SECONDS = 30;

export { INVOICE_SOURCE, INVOICE_STATUS } from "./invoice";
export type { InvoiceSource, InvoiceStatus } from "./invoice";
