"use client";

import { API_URL } from "./api";

export const PARENT_MOBILE_SESSION_KEY = "parent.selectedMobile";
export const PARENT_STUDENT_SESSION_KEY = "parent.selectedStudent";

export function setParentMobileSession(mobile: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PARENT_MOBILE_SESSION_KEY, mobile);
}

export function getParentMobileSession(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PARENT_MOBILE_SESSION_KEY) ?? "";
}

export function clearParentMobileSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PARENT_MOBILE_SESSION_KEY);
}

export function setParentSelectedStudentSession(studentUsername: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PARENT_STUDENT_SESSION_KEY, studentUsername);
}

export function getParentSelectedStudentSession(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PARENT_STUDENT_SESSION_KEY) ?? "";
}

export function clearParentSelectedStudentSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PARENT_STUDENT_SESSION_KEY);
}

export function clearParentSession(): void {
  clearParentMobileSession();
  clearParentSelectedStudentSession();
  void fetch(`${API_URL}/api/auth/parent-delegate-logout`, {
    method: "POST",
    credentials: "include",
  });
}
