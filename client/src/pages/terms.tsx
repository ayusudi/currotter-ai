import { Camera, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Camera className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">Currotter</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-1" data-testid="button-back-terms">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2" data-testid="text-terms-title">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: February 23, 2026</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Currotter ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and your continued use of the Service constitutes acceptance of any changes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Currotter is an AI-powered photo curation tool that processes uploaded images to remove duplicates, blurry photos, and low-quality images. The Service uses artificial intelligence to analyze, score, and select the best photos from a collection. Results are provided on a best-effort basis and may not always match your personal preferences.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                You must create an account to use the Service. You can sign in using your Google account or email through our authentication provider (Replit Auth). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">4. User Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain all ownership rights to the photos and images you upload to the Service ("User Content"). By uploading content, you grant Currotter a limited, non-exclusive, temporary license to process, analyze, and store your images solely for the purpose of providing the curation service. You represent and warrant that you have all necessary rights to upload the content you submit.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
                <li>Upload content that is illegal, harmful, threatening, abusive, or otherwise objectionable</li>
                <li>Upload content that infringes on the intellectual property rights of others</li>
                <li>Attempt to circumvent any security features of the Service</li>
                <li>Use the Service for any unauthorized or illegal purpose</li>
                <li>Upload malicious files or attempt to compromise the Service's infrastructure</li>
                <li>Use automated tools to access the Service in a way that exceeds reasonable usage</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">6. Image Processing and Storage</h2>
              <p className="text-muted-foreground leading-relaxed">
                Uploaded images are temporarily stored on cloud servers (DigitalOcean Spaces) for the duration of the processing session. Images are processed using AI models for quality assessment and curation. Processed images may be exported to your Google Drive at your request. We do not permanently retain uploaded images after your session ends.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">7. Google Drive Integration</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service offers optional integration with Google Drive to export curated photos. By using this feature, you authorize Currotter to create folders and upload files to your Google Drive account. This integration is facilitated through secure OAuth authentication, and you can revoke access at any time through your Google account settings.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. Currotter does not guarantee that the AI curation will produce perfect results. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, including but not limited to loss of data or images.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">9. Service Modifications</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify, suspend, or discontinue the Service at any time without prior notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">10. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will cease immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">11. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact us through the application.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
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
