import { useFetcher } from "@remix-run/react";
import { useCallback } from "react";
import type { RootLoginActionData } from "~/lib/action-types";

/** Submits Root Super Admin credentials to the /root-access action. */
export function useRootLogin(initial: { locked: boolean; remaining: number }) {
  const fetcher = useFetcher<RootLoginActionData>();
  const data = fetcher.data;

  const submit = useCallback(
    (values: { email: string; password: string; totp: string }) => {
      fetcher.submit(values, { method: "post", action: "/root-access" });
    },
    [fetcher],
  );

  return {
    submit,
    isSubmitting: fetcher.state !== "idle",
    error: data && !data.ok ? data.error : null,
    locked: data?.locked ?? initial.locked,
    remaining: data?.remaining ?? initial.remaining,
  };
}
