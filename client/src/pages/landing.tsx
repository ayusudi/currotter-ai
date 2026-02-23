import { Camera, Sparkles, Layers, Zap, Shield, Download, ArrowRight, Check } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@/assets/images/hero-landing.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md" data-testid="nav-landing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Currotter</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/api/login">
              <Button variant="ghost" size="sm" data-testid="button-login">
                Log in
              </Button>
            </a>
            <a href="/api/login">
              <Button size="sm" data-testid="button-get-started-nav">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-primary/5 text-primary text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Photo Curation
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
                Keep the best,
                <br />
                <span className="text-primary">ditch the rest.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Upload hundreds of event photos and let our three-agent AI pipeline
                automatically remove duplicates, blurry shots, and low-quality images.
                Get back only your best photos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/api/login">
                <Button size="lg" className="gap-2 text-base w-full sm:w-auto" data-testid="button-get-started-hero">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="text-base w-full sm:w-auto" data-testid="button-learn-more">
                  Learn More
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <SiGoogle className="h-3.5 w-3.5" />
                Google login
              </span>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <img
              src={heroImage}
              alt="AI Photo Curation"
              className="relative rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
              data-testid="img-hero"
            />
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold">Three AI agents, one curated album</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our multi-agent pipeline processes your photos through three specialized stages to deliver only the best.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-8 space-y-4 bg-background/50 hover:bg-background transition-colors border hover:shadow-lg" data-testid="card-feature-filter">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Filtering Agent</h3>
              <p className="text-muted-foreground leading-relaxed">
                Detects and removes duplicate photos using perceptual hashing, flags blurry images with Laplacian variance analysis, and filters extreme brightness.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-background/50 hover:bg-background transition-colors border hover:shadow-lg" data-testid="card-feature-analysis">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Analysis Agent</h3>
              <p className="text-muted-foreground leading-relaxed">
                Each photo is evaluated by an AI vision model that scores aesthetic quality on a 0–1 scale and generates a scene description for intelligent grouping.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-background/50 hover:bg-background transition-colors border hover:shadow-lg" data-testid="card-feature-decision">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Decision Agent</h3>
              <p className="text-muted-foreground leading-relaxed">
                Groups similar photos into visual clusters using cosine similarity, then picks the top-scoring image from each cluster based on a weighted composite score.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold">How it works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three simple steps to go from hundreds of photos to a curated album.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4" data-testid="step-upload">
              <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto text-2xl font-bold">1</div>
              <h3 className="text-lg font-semibold">Upload your photos</h3>
              <p className="text-muted-foreground">Drag and drop up to 50 images at once. We accept JPEG, PNG, WebP, and more.</p>
            </div>

            <div className="text-center space-y-4" data-testid="step-curate">
              <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto text-2xl font-bold">2</div>
              <h3 className="text-lg font-semibold">Choose a curation mode</h3>
              <p className="text-muted-foreground">Pick Social for more variety or Minimal for only the absolute best shots from each group.</p>
            </div>

            <div className="text-center space-y-4" data-testid="step-download">
              <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto text-2xl font-bold">3</div>
              <h3 className="text-lg font-semibold">Download your album</h3>
              <p className="text-muted-foreground">Review the curated results and download them all as a ZIP file with one click.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold">Ready to curate your photos?</h2>
          <p className="text-lg text-muted-foreground">
            Sign up with Google or email and start curating your event photos in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/api/login">
              <Button size="lg" className="gap-2 text-base w-full sm:w-auto" data-testid="button-get-started-cta">
                <SiGoogle className="h-4 w-4" />
                Sign up with Google
              </Button>
            </a>
            <a href="/api/login">
              <Button variant="outline" size="lg" className="gap-2 text-base w-full sm:w-auto" data-testid="button-login-email-cta">
                Sign up with Email
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <span className="font-semibold">Currotter</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 Currotter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
