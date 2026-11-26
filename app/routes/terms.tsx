import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { LegalLayout, type LegalSection } from "~/components/layout/LegalLayout";
import { LEGAL } from "~/lib/legal";

export const meta: MetaFunction = () => [
  { title: "Terms of Service · NazmulCodes" },
  { name: "description", content: "The terms for using your NazmulCodes account." },
  { name: "robots", content: "index, follow" },
];

const mail = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
const products = LEGAL.connectedProducts.join(", ");

const sections: LegalSection[] = [
  {
    id: "the-service",
    title: "The service",
    body: (
      <p>
        NazmulCodes Auth gives you one account to sign in to {products} and other NazmulCodes apps. These terms cover
        your account and the sign-in service. Each app may have its own terms for the app itself.
      </p>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    body: (
      <ul>
        <li>Give accurate information, and use an email address that you control.</li>
        <li>
          Keep your password, authenticator app and backup codes safe. You are responsible for what happens under
          your account.
        </li>
        <li>Tell us right away at {mail} if you think someone else has accessed your account.</li>
        <li>You must be old enough to use the service, as described in our <Link to="/privacy#children">Privacy Policy</Link>.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>access accounts that are not yours, or try to guess passwords or codes;</li>
          <li>probe, scan or test the service for weaknesses, or get around its security or rate limits;</li>
          <li>overload the service, or use automated tools to create accounts or sign in;</li>
          <li>use the service for anything illegal, or to harm other people.</li>
        </ul>
        <p>
          If you find a security problem, please report it privately to {mail} instead of exploiting it. We welcome
          good-faith reports.
        </p>
      </>
    ),
  },
  {
    id: "connected-apps",
    title: "Connected apps",
    body: (
      <p>
        When you sign in to a NazmulCodes app, that app receives the account details described in our{" "}
        <Link to="/privacy#sharing">Privacy Policy</Link>. You can disconnect an app at any time in Account → Security.
      </p>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and closing your account",
    body: (
      <>
        <p>
          We may suspend or close an account that breaks these terms, puts other users or the service at risk, or
          when the law requires it. A suspended account cannot sign in to any NazmulCodes app. Where it is reasonable,
          we will tell you why.
        </p>
        <p>You can ask us to delete your account at any time by emailing {mail}.</p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        We work to keep the service available and secure, but we cannot promise it will always be uninterrupted or
        error-free. We may change, add or remove features. If we plan to shut the service down, we will give
        reasonable notice where we can.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    body: (
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent the law allows,
        we make no warranties of any kind, whether express or implied, including warranties of merchantability,
        fitness for a particular purpose and non-infringement.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the fullest extent the law allows, {LEGAL.operator} is not liable for any indirect, incidental, special or
        consequential damages, or for any loss of data, profits or business, that arises from your use of the
        service. Nothing in these terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. We will change the date at the top of this page and, for significant changes, tell
        you before they take effect. If you keep using the service after that, you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms? Email {mail}.</p>,
  },
];

export default function TermsRoute() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={
        <p>
          These terms apply when you create or use a NazmulCodes account. By using the service, you agree to them and
          to our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      }
      sections={sections}
    />
  );
}
