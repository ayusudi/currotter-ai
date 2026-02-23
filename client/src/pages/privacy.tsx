import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/images/otter-mascot.png" alt="Currotter" className="h-8 w-8" />
              <span className="text-xl font-bold tracking-tight">Currotter</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-1" data-testid="button-back-privacy">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: February 23, 2026</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Currotter ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered photo curation service. Please read this policy carefully. By using the Service, you consent to the data practices described in this policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">2. Information We Collect</h2>
              <h3 className="text-lg font-medium mt-4">Account Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you create an account, we collect information provided through our authentication provider (Replit Auth), which may include:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
                <li>Email address</li>
                <li>First and last name</li>
                <li>Profile image URL</li>
                <li>Unique user identifier</li>
              </ul>

              <h3 className="text-lg font-medium mt-4">Uploaded Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you use the curation feature, we temporarily process and store the images you upload. This includes the image files themselves and metadata derived from AI analysis (quality scores, scene descriptions, visual embeddings).
              </p>

              <h3 className="text-lg font-medium mt-4">Usage Data</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may automatically collect certain information about how you access and use the Service, including your curation mode preferences and session activity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process and curate your uploaded photos using AI analysis</li>
                <li>Authenticate your identity and manage your account</li>
                <li>Export curated photos to your Google Drive when you request it</li>
                <li>Communicate with you about the Service</li>
                <li>Monitor and analyze usage patterns to improve the Service</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">4. Image Processing and AI</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your uploaded images are processed by our AI pipeline, which includes sending images to third-party AI services (DigitalOcean Gradient AI) for aesthetic quality scoring and scene analysis. These services process images solely for the purpose of generating quality assessments and do not retain your images beyond the processing session. AI-generated analysis data (scores, descriptions) is used only within your curation session and is not shared with third parties.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">5. Data Storage and Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                Uploaded images are temporarily stored on DigitalOcean Spaces (cloud storage) during your curation session. Images are stored only for the duration necessary to complete the curation process. Session data, including processed results, is held in memory and is not permanently persisted. Your account information (email, name) is stored in our PostgreSQL database for authentication purposes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">We use the following third-party services to operate Currotter:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
                <li><strong>Replit Auth</strong> — For user authentication via OpenID Connect (Google login and email)</li>
                <li><strong>DigitalOcean Spaces</strong> — For temporary cloud storage of uploaded images</li>
                <li><strong>DigitalOcean Gradient AI</strong> — For AI-powered image analysis and aesthetic scoring</li>
                <li><strong>Google Drive</strong> — For optional export of curated photos to your personal Drive (only when you initiate the export)</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                Each third-party service has its own privacy policy governing their handling of data. We encourage you to review their respective privacy policies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">7. Google Drive Integration</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you choose to export curated photos to Google Drive, we access your Google Drive solely to create a folder and upload your curated images. We do not read, modify, or delete any existing files in your Google Drive. The Google Drive connection is managed through secure OAuth 2.0 authentication, and you can revoke Currotter's access at any time through your Google Account settings.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">8. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information and uploaded content. This includes encrypted connections (HTTPS/TLS), secure session management, and access controls. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">9. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your account and associated data</li>
                <li>Object to or restrict certain processing activities</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                To exercise any of these rights, please contact us through the application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">10. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">11. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Service after any changes indicates your acceptance of the updated policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us through the application.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/images/otter-mascot.png" alt="Currotter" className="h-5 w-5" />
            <span className="font-semibold">Currotter</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 Currotter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
