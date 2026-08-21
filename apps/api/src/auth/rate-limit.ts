import { AppError } from "../common/app-error.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;

type LoginFailureState = {
  count: number;
  resetAt: number;
};

const loginFailures = new Map<string, LoginFailureState>();

function getKey(email: string): string {
  return email.trim().toLowerCase();
}

function getState(email: string, now: number): LoginFailureState | null {
  const state = loginFailures.get(getKey(email));
  if (!state) {
    return null;
  }

  if (now >= state.resetAt) {
    loginFailures.delete(getKey(email));
    return null;
  }

  return state;
}

export function assertLoginAllowed(email: string): void {
  const now = Date.now();
  const state = getState(email, now);

  if (state && state.count >= LOGIN_FAILURE_LIMIT) {
    throw new AppError("RATE_LIMITED", "Terlalu banyak percobaan login. Coba lagi nanti.", 429);
  }
}

export function recordLoginFailure(email: string): void {
  const now = Date.now();
  const state = getState(email, now);
  const key = getKey(email);

  loginFailures.set(key, {
    count: (state?.count ?? 0) + 1,
    resetAt: state?.resetAt ?? now + LOGIN_WINDOW_MS,
  });
}

export function resetLoginFailures(email: string): void {
  loginFailures.delete(getKey(email));
}
