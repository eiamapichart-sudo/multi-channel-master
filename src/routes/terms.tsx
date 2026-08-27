import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/app/SiteFooter";

const LAST_UPDATED = "August 27, 2026";
const CONTACT_EMAIL = "support@socialpost.app";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Social Post" },
      {
        name: "description",
        content:
          "Terms of Service for Social Post — the rules and conditions for using the app to schedule and publish content to TikTok, Facebook Page, and Instagram.",
      },
      { property: "og:title", content: "Terms of Service — Social Post" },
      {
        property: "og:description",
        content:
          "Terms of Service for Social Post — the rules and conditions for using the app to schedule and publish content to TikTok, Facebook Page, and Instagram.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
            TERMS OF SERVICE
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="space-y-10 text-[15px] leading-8 text-foreground/90">
          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account and using Social Post (the "App"), you agree
              to be bound by these Terms of Service. If you do not agree to these
              terms, do not use the App.
            </p>
          </Section>

          <Section title="2. Scope of Service">
            <p>
              Social Post is a tool that helps you create, schedule, and publish
              posts to the social media accounts you connect — currently TikTok,
              Facebook Page, and Instagram. The App publishes content on your
              behalf only when you instruct it to, either immediately or at a
              scheduled time, and only after any approval workflow you have
              configured is completed.
            </p>
            <p>
              The App does not guarantee that content will be successfully
              published on any third-party platform, as publishing depends on
              factors outside our control, including the availability and
              policies of those platforms.
            </p>
          </Section>

          <Section title="3. User Responsibilities">
            <p>
              You are the owner of all content you create, schedule, or publish
              through the App. You are solely responsible for the content and for
              any consequences of publishing it.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                You must ensure you have all necessary rights to the content you
                upload and publish.
              </li>
              <li>
                You are responsible for keeping your account credentials and
                connected access tokens secure.
              </li>
              <li>
                You are responsible for complying with all applicable laws and
                with the terms and policies of each destination platform.
              </li>
            </ul>
          </Section>

          <Section title="4. Compliance with Platform Policies">
            <p>
              When publishing content through Social Post, you must comply with
              the policies of the destination platforms, including but not
              limited to:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>TikTok Community Guidelines</strong> and TikTok's Terms
                of Service.
              </li>
              <li>
                <strong>Meta Platform Terms</strong>, Facebook Page policies, and
                Instagram Terms of Use.
              </li>
            </ul>
            <p>
              Violations of a platform's policies may result in that platform
                restricting or removing your content or account, and may also
                constitute a breach of these Terms.
            </p>
          </Section>

          <Section title="5. Prohibited Uses">
            <p>You agree not to use the App to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Publish spam, unsolicited promotional content, or deceptive
                material.
              </li>
              <li>
                Publish content that is illegal, harmful, threatening, abusive,
                harassing, defamatory, or otherwise objectionable.
              </li>
              <li>
                Publish content that infringes the intellectual property,
                privacy, or other rights of any third party.
              </li>
              <li>
                Attempt to disrupt, overload, or gain unauthorized access to the
                App or its infrastructure.
              </li>
              <li>
                Use the App for any unlawful or fraudulent purpose.
              </li>
            </ul>
          </Section>

          <Section title="6. Account Suspension and Termination">
            <p>
              We may suspend, restrict, or terminate your access to the App if:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>You breach these Terms or any platform policy.</li>
              <li>Your conduct causes harm to us, other users, or third parties.</li>
              <li>
                A destination platform revokes the App's ability to publish on
                your behalf.
              </li>
            </ul>
            <p>
              You may close your account at any time by contacting us. Upon
              closure, your stored data will be deleted in accordance with our
              Privacy Policy.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The App, its design, features, and branding are owned by Social
              Post. You retain all rights to the content you create and publish
              through the App.
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p>
              The App is provided "as is" and "as available" without warranties
              of any kind, whether express or implied. We do not guarantee that
              the App will be uninterrupted, error-free, or that content will be
              successfully published on any platform.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Social Post shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of data, profits, or business,
              arising out of or related to your use of the App, even if we have
              been advised of the possibility of such damages.
            </p>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these Terms from time to time. The "Last updated"
              date at the top of this page reflects the most recent revision.
              Continued use of the App after a change indicates your acceptance
              of the updated Terms.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the
              laws of the Kingdom of Thailand. Any disputes arising under these
              Terms shall be subject to the exclusive jurisdiction of the courts
              of Thailand.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              If you have any questions about these Terms, you can reach us at:
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
