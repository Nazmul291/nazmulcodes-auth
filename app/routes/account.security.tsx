import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AppWindow, ShieldCheck, UserRound } from "lucide-react";
import { AccountNav } from "~/components/layout/AccountNav";
import { AppShell } from "~/components/layout/AppShell";
import { UserChip } from "~/components/layout/UserChip";
import { ConnectedAppsList } from "~/components/security/ConnectedAppsList";
import { TotpSetupWizard } from "~/components/security/TotpSetupWizard";
import { TwoFactorManage } from "~/components/security/TwoFactorManage";
import { Badge, Card, CardBody, CardHeader } from "~/components/ui";
import { useCopy } from "~/hooks/useCopy";
import { useTotpCountdown } from "~/hooks/useTotpCountdown";
import { useTwoFactor } from "~/hooks/useTwoFactor";
import { useLogout } from "~/hooks/useUserAuth";
import type { TwoFactorActionData, TwoFactorIntent } from "~/lib/action-types";
import { db } from "~/lib/db.server";
import { assertSameOrigin } from "~/lib/http.server";
import { secondFactorSchema, totpCodeSchema } from "~/lib/validation";
import { audit } from "~/services/audit.server";
import { rateLimit } from "~/services/rate-limit.server";
import { commitUserSession, requireUser, toPublicUser, withCookies } from "~/services/session.server";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  remainingBackupCodes,
  startTwoFactorSetup,
  verifySecondFactor,
} from "~/services/totp.server";
import { useAuthStore } from "~/store/useAuthStore";

export const meta: MetaFunction = () => [{ title: "Security · NazmulCodes" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const [connections, backupLeft] = await Promise.all([
    db.appConnection.findMany({
      where: { userId: user.id, clientApp: { status: "ACTIVE" } },
      include: { clientApp: { select: { name: true, slug: true } } },
      orderBy: { lastUsedAt: "desc" },
    }),
    user.twoFactorEnabled ? remainingBackupCodes(user.id) : Promise.resolve(0),
  ]);
  return json({
    user: toPublicUser(user),
    backupLeft,
    connections: connections.map((c) => ({
      clientAppId: c.clientAppId,
      name: c.clientApp.name,
      slug: c.clientApp.slug,
      firstConnectedAt: c.firstConnectedAt.toISOString(),
      lastUsedAt: c.lastUsedAt.toISOString(),
    })),
  });
}

const fail = (intent: TwoFactorIntent, error: string, status = 400) =>
  json<TwoFactorActionData>({ ok: false, intent, error }, { status });

export async function action({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent")) as TwoFactorIntent;

  const guarded = intent === "confirm-setup" || intent === "disable" || intent === "regenerate-backup-codes";
  if (guarded && !(await rateLimit(`2fa-manage:${user.id}`, 8, 15 * 60)).ok) {
    return fail(intent, "Too many attempts. Try again in a few minutes.", 429);
  }

  switch (intent) {
    case "start-setup": {
      if (user.twoFactorEnabled) return fail(intent, "Two-factor authentication is already enabled.");
      const enrollment = await startTwoFactorSetup(user);
      return json<TwoFactorActionData>({ ok: true, intent, enrollment });
    }
    case "confirm-setup": {
      const code = totpCodeSchema.safeParse(form.get("code"));
      if (!code.success) return fail(intent, code.error.issues[0]!.message);
      const backupCodes = await confirmTwoFactorSetup(user.id, code.data);
      if (!backupCodes) return fail(intent, "That code didn't match. Check your device's clock and try again.");
      void audit({ actorType: "USER", actorId: user.id, action: "user.2fa.enabled", request });
      // Upgrade this session to mfa=true; any other session without 2FA is now invalid.
      return json<TwoFactorActionData>({ ok: true, intent, backupCodes }, withCookies([commitUserSession(user, true)]));
    }
    case "disable":
    case "regenerate-backup-codes": {
      if (!user.twoFactorEnabled) return fail(intent, "Two-factor authentication is not enabled.");
      const code = secondFactorSchema.safeParse(form.get("code"));
      if (!code.success) return fail(intent, code.error.issues[0]!.message);
      const check = await verifySecondFactor(user.id, code.data);
      if (!check.ok) {
        void audit({ actorType: "USER", actorId: user.id, action: `user.2fa.${intent}.failed`, success: false, request });
        return fail(intent, "Invalid or already-used code.", 401);
      }
      if (intent === "disable") {
        await disableTwoFactor(user.id);
        void audit({ actorType: "USER", actorId: user.id, action: "user.2fa.disabled", request });
        return json<TwoFactorActionData>({ ok: true, intent });
      }
      const backupCodes = await regenerateBackupCodes(user.id);
      void audit({ actorType: "USER", actorId: user.id, action: "user.2fa.backup_codes_regenerated", request });
      return json<TwoFactorActionData>({ ok: true, intent, backupCodes });
    }
    case "revoke-app": {
      const clientAppId = String(form.get("clientAppId") ?? "");
      const connection = await db.appConnection.findUnique({
        where: { userId_clientAppId: { userId: user.id, clientAppId } },
        include: { clientApp: { select: { name: true } } },
      });
      if (!connection) return fail(intent, "App connection not found.", 404);
      await db.appConnection.delete({ where: { id: connection.id } });
      void audit({ actorType: "USER", actorId: user.id, action: "user.app.revoked", request, metadata: { clientAppId } });
      return json<TwoFactorActionData>({ ok: true, intent, appName: connection.clientApp.name });
    }
    default:
      return fail(intent, "Unknown action.");
  }
}

export default function AccountSecurityRoute() {
  const { user, connections, backupLeft } = useLoaderData<typeof loader>();
  const tf = useTwoFactor();
  const { logout, isLoggingOut } = useLogout();
  const countdown = useTotpCountdown();
  const { copied, copy } = useCopy();
  const { twoFactorStep, enrollment, backupCodes, setTwoFactorStep, resetTwoFactorWizard } = useAuthStore();

  const showWizard = !user.twoFactorEnabled || twoFactorStep === "backup";
  const backupDownloadHref = backupCodes
    ? `data:text/plain;charset=utf-8,${encodeURIComponent(
        `NazmulCodes backup codes for ${user.email}\nEach code can be used once.\n\n${backupCodes.join("\n")}\n`,
      )}`
    : "#";

  return (
    <AppShell
      nav={<AccountNav />}
      actions={<UserChip label={user.name ?? user.email} sublabel={user.name ? user.email : undefined} avatarUrl={user.avatarUrl} onLogout={() => logout("user")} loggingOut={isLoggingOut} />}
    >
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="text-sm text-neutral-500">Manage how you sign in to every NazmulCodes app.</p>
        </div>

        <Card>
          <CardHeader icon={<UserRound className="h-4 w-4" />} title="Account" description={user.email} />
          <CardBody className="flex flex-wrap gap-2">
            {user.hasGoogle ? <Badge>Google linked</Badge> : null}
            {user.hasPassword ? <Badge>Password</Badge> : null}
            <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Email verified" : "Email unverified"}</Badge>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Two-factor authentication"
            description="Required at sign-in and before any app receives your identity."
          />
          <CardBody>
            {showWizard ? (
              <TotpSetupWizard
                step={twoFactorStep}
                enrollment={enrollment}
                backupCodes={backupCodes}
                starting={tf.pendingIntent === "start-setup"}
                confirming={tf.pendingIntent === "confirm-setup"}
                countdown={countdown}
                copied={copied}
                onStart={tf.startSetup}
                onNext={() => setTwoFactorStep("verify")}
                onBack={() => setTwoFactorStep("scan")}
                onConfirm={tf.confirmSetup}
                onCopy={copy}
                onFinish={resetTwoFactorWizard}
                onCancel={resetTwoFactorWizard}
                backupDownloadHref={backupDownloadHref}
              />
            ) : (
              <TwoFactorManage
                remainingBackupCodes={backupLeft}
                pending={tf.pendingIntent === "disable" || tf.pendingIntent === "regenerate-backup-codes" ? tf.pendingIntent : null}
                onDisable={tf.disable}
                onRegenerate={tf.regenerateBackupCodes}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<AppWindow className="h-4 w-4" />}
            title="Connected apps"
            description="Apps that received your NazmulCodes identity. Disconnecting makes their next verification check fail."
          />
          <CardBody>
            <ConnectedAppsList apps={connections} revokingId={tf.revokingId} onRevoke={tf.revokeApp} />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
