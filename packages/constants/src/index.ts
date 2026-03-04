/**
 * Shared constants and enums for FUNT Platform.
 * Used by backend, admin, and lms apps.
 * Do not hardcode these strings in apps — always use these constants.
 */

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

/** Assignment submission review status */
export enum SUBMISSION_REVIEW_STATUS {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum COURSE_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum BATCH_STATUS {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

/** Submission type for assignments */
export enum SUBMISSION_TYPE {
  FILE = "file",
  TEXT = "text",
  LINK = "link",
}

/** Skill tags for assignments */
export enum SKILL_TAG {
  ELECTRONICS = "Electronics",
  MECHANICAL = "Mechanical",
  PROGRAMMING = "Programming",
  ALGORITHMS = "Algorithms",
  CREATIVITY = "Creativity",
  INNOVATION = "Innovation",
}

/** Attendance record status */
export enum ATTENDANCE_STATUS {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
}

/** Certificate status */
export enum CERTIFICATE_STATUS {
  ISSUED = "ISSUED",
  REVOKED = "REVOKED",
}

/** Achievement badge types */
export enum BADGE_TYPE {
  FIRST_ASSIGNMENT_SUBMITTED = "FIRST_ASSIGNMENT_SUBMITTED",
  SEVEN_DAY_STREAK = "SEVEN_DAY_STREAK",
  FIRST_COURSE_COMPLETED = "FIRST_COURSE_COMPLETED",
  PERFECT_ATTENDANCE_MONTH = "PERFECT_ATTENDANCE_MONTH",
}
