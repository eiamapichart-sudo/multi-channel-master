import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/app/SiteFooter";

const LAST_UPDATED = "August 27, 2026";
const CONTACT_EMAIL = "support@socialpost.app";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Social Post" },
      {
        name: "description",
        content:
          "Privacy Policy for Social Post — how we collect, use, and protect your data when scheduling and publishing content to TikTok, Facebook Page, and Instagram.",
      },
      { property: "og:title", content: "Privacy Policy — Social Post" },
      {
        property: "og:description",
        content:
          "Privacy Policy for Social Post — how we collect, use, and protect your data when scheduling and publishing content to TikTok, Facebook Page, and Instagram.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-56 bg-[var(--gradient-glow)]" />
      <header className="relative border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Link
            to="/"
            className="font-display text-sm font-bold text-primary transition-colors hover:opacity-80"
          >
            ← Social Post
          </Link>
          <p className="mt-6 font-mono text-xs tracking-widest text-primary">
            PRIVACY POLICY
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="space-y-10 text-[15px] leading-8 text-foreground/90">
          <Section title="1. Overview">
            <p>
              Social Post ("we", "us", or "the App") is a content scheduling and
              publishing tool. It allows you to create a post once and publish it
              to the social media channels you connect — currently TikTok,
              Facebook Page, and Instagram — either immediately or at a scheduled
              time, with an optional approval workflow.
            </p>
            <p>
              This Privacy Policy explains what information the App collects, why
              it is collected, how it is stored, and the rights you have over
              your data.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>When you use Social Post, we may collect and process the following:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Connected account identifiers:</strong> the account name
                and user ID of the social accounts you choose to connect (e.g.
                your TikTok username, Facebook Page name and ID, Instagram
                Business account name and ID).
              </li>
              <li>
                <strong>Access tokens:</strong> OAuth access tokens and, where
                applicable, refresh tokens issued by TikTok and Meta, used to
                publish content on your behalf.
              </li>
              <li>
                <strong>Post content:</strong> the text, captions, and media
                files (images and videos) that you upload and choose to publish
                or schedule.
              </li>
              <li>
                <strong>Account email:</strong> the email address associated with
                your Social Post account, used for authentication and
                account-related notifications.
              </li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>
              The information listed above is used solely to perform the actions
              you explicitly request within the App — creating, scheduling,
              approving, and publishing your content to the connected platforms.
            </p>
            <p>
              We do <strong>not</strong> sell your data, and we do not share or
              transfer your personal information to third parties for
              advertising purposes.
            </p>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Access tokens and refresh tokens are stored on the server side.
              They are not exposed to other users and are not accessible through
              the public interface of the App. Media files you upload are stored
              in a private storage bucket and accessed via time-limited signed
              URLs.
            </p>
            <p>
              Access to your data is protected by Row-Level Security policies so
              that each user can only access their own data.
            </p>
          </Section>

          <Section title="5. Sharing with Third Parties">
            <p>
              To publish content on your behalf, the App sends your post text and
              media files to the official APIs of the destination platforms:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>TikTok</strong> — via the TikTok Content Posting API.
              </li>
              <li>
                <strong>Meta (Facebook Page & Instagram)</strong> — via the
                Facebook Graph API.
              </li>
            </ul>
            <p>
              No other third parties receive your data. The platforms above
              process your data subject to their own privacy policies and terms.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>You have the following rights regarding your data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Disconnect an account:</strong> You may disconnect any
                connected social account at any time from within the App's
                settings. Disconnecting removes the stored access token so the
                App can no longer publish to that account.
              </li>
              <li>
                <strong>Request deletion:</strong> You may request that all of
                your data — including your account, connected credentials, and
                stored media — be permanently deleted.
              </li>
            </ul>
          </Section>

          <Section title="7. How to Delete Your Data">
            <p>To request deletion of your account and associated data:</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                Sign in to the App and go to{" "}
                <span className="font-medium">Settings</span>.
              </li>
              <li>
                Disconnect each connected social account to revoke the stored
                tokens.
              </li>
              <li>
                Contact us at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                with the subject “Account Deletion Request” and the email
                address registered to your account. We will permanently remove
                your account and remaining data within 30 days.
              </li>
            </ol>
          </Section>

          <Section title="8. Data Retention">
            <p>
              We retain your data only for as long as your account is active.
              Post content and media are kept so you can review your publishing
              history. When you delete a post, its media is removed. When you
              delete your account, all associated data is permanently deleted.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. The "Last
              updated" date at the top of this page reflects the most recent
              revision. Continued use of the App after a change indicates your
              acceptance of the updated policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              If you have any questions about this Privacy Policy or your data,
              you can reach us at:
            </p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
