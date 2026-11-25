import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect } from "react";
import type { ClientAppActionData, ClientAppIntent } from "~/lib/action-types";
import { useAuthStore } from "~/store/useAuthStore";

const ACTION = "/admin/apps";

export interface ClientAppFormValues {
  name: string;
  slug: string;
  description: string;
  allowedOrigins: string;
  callbackUrls: string;
}

/** Shared fetcher plumbing: toasts + one-time key reveal. */
function useClientAppFetcher(onSuccess?: () => void) {
  const fetcher = useFetcher<ClientAppActionData>();
  const { pushToast, revealKey } = useAuthStore();

  useEffect(() => {
    const data = fetcher.data;
    if (!data || fetcher.state !== "idle") return;
    if (!data.ok) {
      if (!data.fieldErrors) pushToast("error", data.error);
      return;
    }
    if (data.intent === "create" || data.intent === "rotate-key") {
      revealKey({ appName: data.appName, apiKey: data.apiKey, reason: data.intent === "create" ? "created" : "rotated" });
    } else {
      pushToast("success", `${data.appName} updated.`);
    }
    onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  const send = useCallback(
    (intent: ClientAppIntent, values: Record<string, string>) =>
      fetcher.submit({ intent, ...values }, { method: "post", action: ACTION }),
    [fetcher],
  );

  const data = fetcher.data;
  return {
    send,
    isSubmitting: fetcher.state !== "idle",
    pendingIntent: fetcher.state !== "idle" ? ((fetcher.formData?.get("intent") as ClientAppIntent) ?? null) : null,
    fieldErrors: (data && !data.ok && data.fieldErrors) || {},
  };
}

/** Create a new client app (API key revealed once on success). */
export function useCreateClientApp(onCreated?: () => void) {
  const f = useClientAppFetcher(onCreated);
  return {
    create: (values: ClientAppFormValues) => f.send("create", { ...values }),
    isSubmitting: f.isSubmitting,
    fieldErrors: f.fieldErrors,
  };
}

/** Edit / suspend / rotate key for one existing client app. */
export function useClientAppActions(appId: string, onSaved?: () => void) {
  const f = useClientAppFetcher(onSaved);
  return {
    update: (values: ClientAppFormValues) => f.send("update", { id: appId, ...values }),
    setStatus: (status: "ACTIVE" | "SUSPENDED") => f.send("set-status", { id: appId, status }),
    rotateKey: () => f.send("rotate-key", { id: appId }),
    pendingIntent: f.pendingIntent,
    fieldErrors: f.fieldErrors,
  };
}
