import { useFetcher } from "@remix-run/react";
import { useCallback } from "react";
import type { UserAuthActionData } from "~/lib/action-types";

function useAuthFetcher(action: string) {
  const fetcher = useFetcher<UserAuthActionData>();
  const data = fetcher.data;
  return {
    fetcher,
    isSubmitting: fetcher.state !== "idle",
    error: data && !data.ok ? data.error : null,
    fieldErrors: (data && !data.ok && data.fieldErrors) || {},
    submit: (values: Record<string, string>) => fetcher.submit(values, { method: "post", action }),
  };
}

/** Email/password sign-in → /login action. */
export function useLogin(returnTo: string) {
  const f = useAuthFetcher("/login");
  const login = useCallback(
    (values: { email: string; password: string }) => f.submit({ ...values, returnTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.fetcher, returnTo],
  );
  return { login, isSubmitting: f.isSubmitting, error: f.error, fieldErrors: f.fieldErrors };
}

/** Email/password registration → /register action. */
export function useRegister(returnTo: string) {
  const f = useAuthFetcher("/register");
  const register = useCallback(
    (values: { name: string; email: string; password: string }) => f.submit({ ...values, returnTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.fetcher, returnTo],
  );
  return { register, isSubmitting: f.isSubmitting, error: f.error, fieldErrors: f.fieldErrors };
}

/** TOTP / backup-code challenge → /login/2fa action. */
export function useTwoFactorChallenge() {
  const f = useAuthFetcher("/login/2fa");
  const verify = useCallback(
    (code: string) => f.submit({ code }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.fetcher],
  );
  return { verify, isSubmitting: f.isSubmitting, error: f.error };
}

/** POST /logout (scope: user | admin | all). */
export function useLogout() {
  const fetcher = useFetcher();
  return {
    logout: (scope: "user" | "admin" | "all" = "all") =>
      fetcher.submit({ scope }, { method: "post", action: "/logout" }),
    isLoggingOut: fetcher.state !== "idle",
  };
}
