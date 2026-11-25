import { Ban, KeyRound, Pencil, PlayCircle, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ClientAppFormValues } from "~/hooks/useClientApps";
import type { ClientAppIntent } from "~/lib/action-types";
import { Badge, Button, Card, CardBody, CardHeader, Modal } from "../ui";
import { CreateAppForm } from "./CreateAppForm";

export interface ClientAppCardData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "SUSPENDED";
  allowedOrigins: string[];
  callbackUrls: string[];
  apiKeyPrefix: string;
  apiKeyRotatedAt: string;
  createdAt: string;
  connectionCount: number;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function ClientAppCard({
  app,
  pendingIntent,
  fieldErrors,
  editing,
  onEditToggle,
  onUpdate,
  onSetStatus,
  onRotateKey,
}: {
  app: ClientAppCardData;
  pendingIntent: ClientAppIntent | null;
  fieldErrors: Record<string, string>;
  editing: boolean;
  onEditToggle: (editing: boolean) => void;
  onUpdate: (values: ClientAppFormValues) => void;
  onSetStatus: (status: "ACTIVE" | "SUSPENDED") => void;
  onRotateKey: () => void;
}) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const active = app.status === "ACTIVE";

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {app.name}
            <Badge tone={active ? "success" : "danger"}>{active ? "Active" : "Suspended"}</Badge>
          </span>
        }
        description={app.description ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEditToggle(!editing)}>
              {editing ? "Close" : "Edit"}
            </Button>
            <Button size="sm" variant="secondary" icon={<KeyRound className="h-3.5 w-3.5" />} loading={pendingIntent === "rotate-key"} onClick={() => setConfirmRotate(true)}>
              Rotate key
            </Button>
            <Button
              size="sm"
              variant={active ? "danger" : "secondary"}
              icon={active ? <Ban className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
              loading={pendingIntent === "set-status"}
              onClick={() => onSetStatus(active ? "SUSPENDED" : "ACTIVE")}
            >
              {active ? "Suspend" : "Activate"}
            </Button>
          </div>
        }
      />
      <CardBody>
        {editing ? (
          <CreateAppForm
            defaults={app}
            slugLocked
            fieldErrors={fieldErrors}
            submitting={pendingIntent === "update"}
            submitLabel="Save changes"
            onSubmit={onUpdate}
            onCancel={() => onEditToggle(false)}
          />
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Meta label="client_id">
              <code className="font-mono text-neutral-200">{app.slug}</code>
            </Meta>
            <Meta label="API key">
              <code className="font-mono text-neutral-200">{app.apiKeyPrefix}…</code>
              <span className="ml-2 text-xs text-neutral-500">rotated {fmt(app.apiKeyRotatedAt)}</span>
            </Meta>
            <Meta label="Callback URLs">
              <UrlList urls={app.callbackUrls} />
            </Meta>
            <Meta label="Allowed origins">
              {app.allowedOrigins.length ? <UrlList urls={app.allowedOrigins} /> : <span className="text-neutral-600">Server-to-server only</span>}
            </Meta>
            <Meta label="Connected users">
              <span className="inline-flex items-center gap-1.5 text-neutral-300">
                <Users className="h-3.5 w-3.5" /> {app.connectionCount}
              </span>
            </Meta>
            <Meta label="Created">{fmt(app.createdAt)}</Meta>
          </dl>
        )}
      </CardBody>

      <Modal
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title={`Rotate API key for ${app.name}?`}
        description="The current key stops working immediately. The app will fail to authenticate until you paste in the new key."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRotate(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmRotate(false);
                onRotateKey();
              }}
            >
              Rotate key
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-400">
          Current key: <code className="font-mono text-neutral-200">{app.apiKeyPrefix}…</code>
        </p>
      </Modal>
    </Card>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-neutral-300">{children}</dd>
    </div>
  );
}

function UrlList({ urls }: { urls: string[] }) {
  return (
    <ul className="space-y-0.5">
      {urls.map((u) => (
        <li key={u} className="truncate font-mono text-xs text-neutral-300" title={u}>
          {u}
        </li>
      ))}
    </ul>
  );
}
