import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, Brain, Zap, Mic, Target, TrendingUp, ChevronRight, Play } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full relative z-20">
        <div className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-lg font-black">A</span>
          </div>
          <span>ADAPT</span>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/auth">
            <Button variant="ghost" size="sm" data-testid="link-login">Sign In</Button>
          </Link>
          <Link href="/auth">
            <Button size="sm" data-testid="link-get-started">
              Try Demo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-6xl mx-auto w-full relative">
        {/* Background Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-secondary border border-primary/10 text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI-Powered Voice Training Platform</span>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black leading-[0.95] mb-6 tracking-tight">
            The AI Mentor
            <br />
            <span className="text-primary">for Onboarding</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            No boring PDFs. Train with voice, drills, and real-time feedback. 
            Create courses in 2 minutes flat.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth?role=employee">
              <Button size="lg" className="text-base px-8 h-14 rounded-2xl shadow-lg shadow-primary/20" data-testid="button-try-demo">
                <Play className="w-5 h-5 mr-2" />
                Try Demo
              </Button>
            </Link>
            <Link href="/auth?role=curator">
              <Button size="lg" variant="outline" className="text-base px-8 h-14 rounded-2xl" data-testid="button-create-track">
                Create a Track
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Floating Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-16 w-full max-w-3xl relative z-10"
        >
          <div className="glass-panel rounded-3xl p-8 md:p-12 text-left">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Roleplay Scenario</p>
                <p className="text-xl md:text-2xl font-medium mb-6">
                  "A customer says they're frustrated with the delivery delay. How do you respond?"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                    <Mic className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Speak your answer</p>
                    <p className="text-sm text-muted-foreground">AI grades in real-time</p>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-48 h-32 rounded-2xl bg-secondary flex items-center justify-center">
                <div className="text-center">
                  <p className="text-4xl font-display font-bold text-primary">9.2</p>
                  <p className="text-sm text-muted-foreground">Your Score</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three steps to mastery</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                icon: Brain, 
                title: "1. Paste Knowledge", 
                desc: "Drop your internal docs. AI transforms them into interactive lessons.",
                gradient: "from-emerald-500/20 to-teal-500/10"
              },
              { 
                icon: Target, 
                title: "2. Train with Voice", 
                desc: "Speak through scenarios. Get instant feedback on your responses.",
                gradient: "from-teal-500/20 to-cyan-500/10"
              },
              { 
                icon: TrendingUp, 
                title: "3. Track Progress", 
                desc: "See who's struggling. Nudge them before it's too late.",
                gradient: "from-cyan-500/20 to-blue-500/10"
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`group p-8 rounded-3xl bg-gradient-to-br ${feature.gradient} border border-primary/5 hover:border-primary/20 transition-all duration-300`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl bg-primary p-12 md:p-16 text-center text-primary-foreground relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Ready to transform your training?</h2>
            <p className="text-lg opacity-90 mb-8 max-w-lg mx-auto">
              Start creating interactive courses today. No credit card required.
            </p>
            <Link href="/auth">
              <Button size="lg" variant="secondary" className="text-base px-10 h-14 rounded-2xl font-semibold" data-testid="button-get-started-cta">
                Get Started Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border/50">
        © 2025 ADAPT. Built for excellence.
      </footer>
    </div>
  );
}
