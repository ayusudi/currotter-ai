import {
  Camera,
  Sparkles,
  Layers,
  Shield,
  ArrowRight,
  Check,
  Heart,
  Zap,
  Search,
  Trophy,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav
        className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md"
        data-testid="nav-landing"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img
              src="/images/otter-welcome.png"
              alt="Currotter"
              className="h-8 w-8 object-contain"
            />
            <span className="text-xl font-bold tracking-tight">Currotter</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </a>
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

      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-primary/10 text-primary text-sm font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Photo Curation
              </motion.div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
                Keep the best,
                <br />
                <span className="text-primary">ditch the rest.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Upload hundreds of event photos and let our friendly otter AI
                automatically remove duplicates, blurry shots, and low-quality
                images. Get back only your best photos!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/api/login">
                <Button
                  size="lg"
                  className="gap-2 text-base w-full sm:w-auto"
                  data-testid="button-get-started-hero"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#how-it-works">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base w-full sm:w-auto"
                  data-testid="button-learn-more"
                >
                  Learn More
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <SiGoogle className="h-3.5 w-3.5" />
                Google login
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/5 rounded-3xl blur-3xl" />
            <div className="relative">
              <img
                src="/images/otter-hero.png"
                alt="Currotter Mascot"
                className="w-72 sm:w-80 lg:w-96 mx-auto animate-float drop-shadow-2xl"
                data-testid="img-hero"
              />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-2xl px-5 py-3 shadow-lg"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-red-400" />
                  <span className="font-medium">
                    Ready to find your best shots!
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t bg-muted/30 bg-dots"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mx-auto"
            >
              <Zap className="h-3.5 w-3.5" />
              Three AI Agents
            </motion.div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold">
              Three friendly agents, one curated album
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our otter team works together through three specialized stages to
              deliver only the best photos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Filtering Agent",
                desc: "Detects and removes duplicate photos using perceptual hashing, flags blurry images, and filters extreme brightness.",
                testId: "card-feature-filter",
                featureIcon: Search,
              },
              {
                icon: Sparkles,
                title: "Analysis Agent",
                desc: "Each photo is evaluated by an AI vision model that scores aesthetic quality and generates a scene description.",
                testId: "card-feature-analysis",
                featureIcon: Sparkles,
              },
              {
                icon: Layers,
                title: "Decision Agent",
                desc: "Groups similar photos into visual clusters, then picks the top-scoring image from each cluster.",
                testId: "card-feature-decision",
                featureIcon: Trophy,
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
              >
                <Card
                  className="p-8 space-y-4 bg-background/50 hover:bg-background transition-all border hover:shadow-lg hover:-translate-y-1 duration-300"
                  data-testid={feature.testId}
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <feature.featureIcon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold">
              How it works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three simple steps to go from hundreds of photos to a curated
              album.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                img: "/images/otter-upload.png",
                title: "Upload your photos",
                desc: "Drag and drop up to 50 images at once. We accept JPEG, PNG, WebP, and more.",
                testId: "step-upload",
              },
              {
                step: "2",
                img: "/images/otter-processing.png",
                title: "Our otter curates them",
                desc: "Pick Social for more variety or Minimal for only the absolute best shots from each group.",
                testId: "step-curate",
              },
              {
                step: "3",
                img: "/images/otter-success.png",
                title: "Download your album",
                desc: "Review the curated results and download as ZIP or save directly to Google Drive.",
                testId: "step-download",
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="text-center space-y-4"
                data-testid={item.testId}
              >
                <div className="relative mx-auto w-28 h-28">
                  <div className="absolute inset-0 bg-primary/10 rounded-full" />
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-contain p-2 relative z-10"
                  />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold z-20">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t bg-muted/30 bg-grid-sm">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <img
              src="/images/otter-welcome.png"
              alt="Otter waving"
              className="w-24 h-24 mx-auto mb-4 animate-wiggle"
            />
            <h2 className="text-3xl sm:text-4xl font-serif font-bold">
              Ready to curate your photos?
            </h2>
            <p className="text-lg text-muted-foreground mt-3">
              Sign up with Google and start curating your event photos in
              seconds.
            </p>
          </motion.div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/api/login">
              <Button
                size="lg"
                className="gap-2 text-base w-full sm:w-auto"
                data-testid="button-get-started-cta"
              >
                <SiGoogle className="h-4 w-4" />
                Sign up with Google
              </Button>
            </a>
            <a href="/api/login">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base w-full sm:w-auto"
                data-testid="button-login-email-cta"
              >
                Sign up with Email
              </Button>
            </a>
          </div>
        </div>
      </section>
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link
                href="/terms"
                className="hover:text-foreground transition-colors"
                data-testid="link-terms"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/privacy"
                className="hover:text-foreground transition-colors"
                data-testid="link-privacy"
              >
                Privacy Policy
              </Link>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            &copy; 2026 Currotter. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
