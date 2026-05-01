/** Dispatched when XP / level may have changed (e.g. chapter completed). StudentLayout listens and refetches `/api/users/me`. */
export const STUDENT_ME_REFRESH_EVENT = "funt-student-me-refresh";

export function emitStudentMeRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDENT_ME_REFRESH_EVENT));
  }
}
