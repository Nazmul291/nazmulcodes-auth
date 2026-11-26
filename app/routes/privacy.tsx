import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { LegalLayout, type LegalSection } from "~/components/layout/LegalLayout";
import { LEGAL } from "~/lib/legal";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy · NazmulCodes" },
  { name: "description", content: "How NazmulCodes Auth collects, uses and protects your account data." },
  { name: "robots", content: "index, follow" },
];

const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
const products = LEGAL.connectedProducts.join(", ");

const sections: LegalSection[] = [
  {
    id: "data-we-collect",
    title: "Information we collect",
    body: (
      <>
        <p>We only collect what we need to run your account and keep it secure:</p>
        <ul>
          <li>
            <strong>Account details:</strong> your email address, your name, and your profile photo if you sign in
            with Google.
          </li>
          <li>
            <strong>Sign-in data:</strong> a one-way hash of your password (never the password itself), your Google
            account ID if you link Google, and whether your email address is verified.
          </li>
          <li>
            <strong>Two-factor authentication:</strong> your authenticator key, stored encrypted, and one-way hashes of
            your backup codes.
          </li>
          <li>
            <strong>Connected apps:</strong> which NazmulCodes apps you have signed in to, and when.
          </li>
          <li>
            <strong>Security logs:</strong> sign-in attempts and account changes, with the IP address and browser
            information (user agent) of the request.
          </li>
        </ul>
        <p>We do not collect payment details, contacts, location data or anything else from your device.</p>
      </>
    ),
  },
  {
    id: "google",
    title: "Information from Google",
    body: (
      <>
        <p>
          If you choose <strong>Continue with Google</strong>, Google shares your basic profile with us: your Google
          account ID, email address, whether that email is verified, your name and your profile photo. We request only
          the <code>openid</code>, <code>email</code> and <code>profile</code> scopes. We cannot see your Google
          password, Gmail, Drive, contacts or any other Google data.
        </p>
        <p>
          We use this information only to sign you in and to show your name and photo in your account. Our use and
          transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use your information",
    body: (
      <ul>
        <li>To create your account and sign you in, including two-factor authentication.</li>
        <li>To let you sign in to NazmulCodes apps with the same account.</li>
        <li>To detect and stop abuse, such as repeated failed sign-ins, and to investigate security incidents.</li>
        <li>To respond when you contact us.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Sharing with NazmulCodes apps",
    body: (
      <>
        <p>
          When you sign in to a NazmulCodes app ({products} and others we may add), that app receives your account ID,
          email address, name, profile photo, and whether you use two-factor authentication. Apps never receive your
          password, your authenticator key or your backup codes.
        </p>
        <p>
          You can see and disconnect apps at any time from{" "}
          <Link to="/account/security">Account → Security</Link>. After you disconnect an app, it can no longer
          confirm your account with us. Each app&apos;s own privacy policy covers what it does with your data.
        </p>
      </>
    ),
  },
  {
    id: "service-providers",
    title: "Service providers",
    body: (
      <>
        <p>
          We do not sell your personal information or use it for advertising. We share it only with providers that
          help us run the service, and only as needed for that purpose:
        </p>
        <ul>
          <li>
            <strong>Google</strong>, if you choose to sign in with Google.
          </li>
          <li>
            <strong>Hosting and database providers</strong> that store and serve the service.
          </li>
        </ul>
        <p>We may also disclose information if the law requires it, or to protect our users and the service.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>We use only essential cookies, which are required for signing in. We do not use analytics or advertising cookies.</p>
        <ul>
          <li>
            <code>nc_session</code>: keeps you signed in, for up to 14 days.
          </li>
          <li>
            <code>nc_2fa</code>: remembers that you passed the password step while you enter your two-factor code, for
            up to 5 minutes.
          </li>
          <li>
            <code>nc_google</code>: protects the Google sign-in step against forgery, for up to 10 minutes.
          </li>
        </ul>
        <p>
          On our live site these names start with <code>__Host-</code>. Each cookie is encrypted, cannot be read by
          JavaScript, and is sent only over a secure connection.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Passwords are stored with bcrypt. Authenticator keys are encrypted with AES-256-GCM. Backup codes and sign-in
        codes for apps are stored only as hashes. Connections use HTTPS. No system is perfectly secure, so we
        recommend turning on two-factor authentication. If we learn of a breach that affects your data, we will tell
        you without undue delay.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <p>
        We keep your account data for as long as your account exists. When you delete your account, we delete your
        account data, two-factor data and app connections. We may keep security logs for longer when we need them to
        investigate abuse or to meet legal obligations.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your choices and rights",
    body: (
      <>
        <ul>
          <li>Turn two-factor authentication on or off, and create new backup codes, in Account → Security.</li>
          <li>Disconnect any NazmulCodes app in Account → Security.</li>
          <li>Ask for a copy of your data, a correction, or deletion of your account by emailing {mail}.</li>
        </ul>
        <p>
          Depending on where you live, you may have further rights, such as the right to object to processing or to
          complain to a data protection authority. We will answer requests within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The service is not intended for children under 13, or under 16 in the European Economic Area and the United
        Kingdom. We do not knowingly collect their data. If you believe a child has created an account, contact us and
        we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we will update the date at the top of this page. If the changes are significant, we
        will also tell you before they take effect, for example when you next sign in.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {LEGAL.operator} runs this service at {LEGAL.serviceUrl}. For any privacy question or request, email {mail}.
      </p>
    ),
  },
];

export default function PrivacyRoute() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={
        <p>
          NazmulCodes Auth is the single sign-on service for {products} and other NazmulCodes apps. This policy
          explains what we collect when you use it, why, and the choices you have.
        </p>
      }
      sections={sections}
    />
  );
}
