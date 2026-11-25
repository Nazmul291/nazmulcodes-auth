import { Prisma } from "@prisma/client";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Boxes, Plus } from "lucide-react";
import { useState } from "react";
import { ApiKeyRevealModal } from "~/components/admin/ApiKeyRevealModal";
import { ClientAppCard, type ClientAppCardData } from "~/components/admin/ClientAppCard";
import { CreateAppForm } from "~/components/admin/CreateAppForm";
import { AdminNav } from "~/components/layout/AdminNav";
import { AppShell } from "~/components/layout/AppShell";
import { UserChip } from "~/components/layout/UserChip";
import { Alert, Button, Card, CardBody, CardHeader } from "~/components/ui";
import { useClientAppActions, useCreateClientApp } from "~/hooks/useClientApps";
import { useCopy } from "~/hooks/useCopy";
import { useLogout } from "~/hooks/useUserAuth";
import type { ClientAppActionData, ClientAppIntent } from "~/lib/action-types";
import { isDatabaseReachable } from "~/lib/db.server";
import { assertSameOrigin } from "~/lib/http.server";
import { clientAppSchema, fieldErrors } from "~/lib/validation";
import { audit } from "~/services/audit.server";
import {
  createClientApp,
  listClientApps,
  rotateClientAppKey,
  setClientAppStatus,
  updateClientApp,
} from "~/services/client-apps.server";
import { requireSuperAdmin } from "~/services/super-admin.server";
import { useAuthStore } from "~/store/useAuthStore";

export const meta: MetaFunction = () => [{ title: "Client apps · NazmulCodes Root" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = requireSuperAdmin(request);
  // Admin must stay usable even if Postgres is down — show a recovery banner instead of crashing.
  if (!(await isDatabaseReachable())) {
    return json({ adminEmail: admin.email, dbOnline: false, apps: [] as ClientAppCardData[] });
  }
  const apps = await listClientApps();
  return json({
    adminEmail: admin.email,
    dbOnline: true,
    apps: apps.map<ClientAppCardData>((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      status: a.status,
      allowedOrigins: a.allowedOrigins,
      callbackUrls: a.callbackUrls,
      apiKeyPrefix: a.apiKeyPrefix,
      apiKeyRotatedAt: a.apiKeyRotatedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      connectionCount: a._count.connections,
    })),
  });
}

const fail = (intent: ClientAppIntent, error: string, status = 400, fe?: Record<string, string>) =>
  json<ClientAppActionData>({ ok: false, intent, error, fieldErrors: fe }, { status });

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const admin = requireSuperAdmin(request);
  const form = Object.fromEntries(await request.formData());
  const intent = String(form.intent) as ClientAppIntent;
  const id = typeof form.id === "string" ? form.id : "";
  const log = (action: string, metadata: Prisma.InputJsonValue) =>
    audit({ actorType: "SUPER_ADMIN", actorId: admin.email, action, request, metadata });

  try {
    switch (intent) {
      case "create": {
        const parsed = clientAppSchema.safeParse(form);
        if (!parsed.success) return fail(intent, "Fix the highlighted fields.", 400, fieldErrors(parsed.error));
        const { app, apiKey } = await createClientApp(parsed.data);
        void log("admin.app.created", { clientAppId: app.id, slug: app.slug });
        return json<ClientAppActionData>({ ok: true, intent, appName: app.name, apiKey });
      }
      case "update": {
        const parsed = clientAppSchema.safeParse(form);
        if (!parsed.success) return fail(intent, "Fix the highlighted fields.", 400, fieldErrors(parsed.error));
        // client_id (slug) is immutable after creation.
        const { slug: _immutable, ...rest } = parsed.data;
        const app = await updateClientApp(id, rest);
        void log("admin.app.updated", { clientAppId: app.id });
        return json<ClientAppActionData>({ ok: true, intent, appName: app.name });
      }
      case "set-status": {
        const status = form.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
        const app = await setClientAppStatus(id, status);
        void log(status === "SUSPENDED" ? "admin.app.suspended" : "admin.app.activated", { clientAppId: app.id });
        return json<ClientAppActionData>({ ok: true, intent, appName: app.name });
      }
      case "rotate-key": {
        const { app, apiKey } = await rotateClientAppKey(id);
        void log("admin.app.key_rotated", { clientAppId: app.id, prefix: app.apiKeyPrefix });
        return json<ClientAppActionData>({ ok: true, intent, appName: app.name, apiKey });
      }
      default:
        return fail(intent, "Unknown action.");
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return fail(intent, "That slug is already taken.", 409, { slug: "That slug is already taken." });
      if (err.code === "P2025") return fail(intent, "App not found.", 404);
    }
    throw err;
  }
}

function ClientAppRow({ app, editing, onEditToggle }: { app: ClientAppCardData; editing: boolean; onEditToggle: (v: boolean) => void }) {
  const actions = useClientAppActions(app.id, () => onEditToggle(false));
  return (
    <ClientAppCard
      app={app}
      editing={editing}
      onEditToggle={onEditToggle}
      pendingIntent={actions.pendingIntent}
      fieldErrors={actions.fieldErrors}
      onUpdate={actions.update}
      onSetStatus={actions.setStatus}
      onRotateKey={actions.rotateKey}
    />
  );
}

export default function AdminAppsRoute() {
  const { apps, adminEmail, dbOnline } = useLoaderData<typeof loader>();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const create = useCreateClientApp(() => setCreating(false));
  const { revealedKey, clearRevealedKey } = useAuthStore();
  const { copied, copy } = useCopy();
  const { logout, isLoggingOut } = useLogout();

  return (
    <AppShell
      logoSuffix="Root"
      nav={<AdminNav />}
      actions={<UserChip label="Root" sublabel={adminEmail} onLogout={() => logout("admin")} loggingOut={isLoggingOut} />}
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Client apps</h1>
            <p className="text-sm text-neutral-500">Apps that delegate sign-in to NazmulCodes Auth.</p>
          </div>
          {dbOnline && !creating ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New app
            </Button>
          ) : null}
        </div>

        {!dbOnline ? (
          <Alert>
            PostgreSQL is unreachable. You are signed in via the environment-backed root account — check
            <code className="mx-1 font-mono">DATABASE_URL</code>, then run <code className="font-mono">npm run db:deploy</code>.
          </Alert>
        ) : null}

        {creating ? (
          <Card>
            <CardHeader title="Register a client app" description="The full API key is shown once after creation." />
            <CardBody>
              <CreateAppForm fieldErrors={create.fieldErrors} submitting={create.isSubmitting} onSubmit={create.create} onCancel={() => setCreating(false)} />
            </CardBody>
          </Card>
        ) : null}

        {dbOnline && apps.length === 0 && !creating ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <Boxes className="h-6 w-6 text-neutral-600" />
              <p className="text-sm text-neutral-400">No client apps yet. Register Veltrix to get started.</p>
            </CardBody>
          </Card>
        ) : null}

        <div className="space-y-4">
          {apps.map((app) => (
            <ClientAppRow key={app.id} app={app} editing={editingId === app.id} onEditToggle={(v) => setEditingId(v ? app.id : null)} />
          ))}
        </div>
      </div>

      <ApiKeyRevealModal revealed={revealedKey} copied={copied} onCopy={copy} onClose={clearRevealedKey} />
    </AppShell>
  );
}
