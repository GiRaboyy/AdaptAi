import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, Brain, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <Brain className="w-8 h-8" />
          <span>Mentora</span>
        </div>
        <div className="flex gap-4">
          <Link href="/auth">
            <Button variant="ghost" className="hidden sm:inline-flex">Login</Button>
          </Link>
          <Link href="/auth">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-5xl mx-auto w-full pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-block py-1 px-3 rounded-full bg-secondary text-primary text-sm font-semibold mb-6">
            AI-Powered Employee Training
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.1] mb-6 text-balance">
            Turn raw knowledge into <span className="text-primary">interactive mastery</span>.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-balance">
            Create immersive training tracks in seconds. Roleplay with AI, test your knowledge, and level up your skills.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth?role=employee">
              <Button size="lg" className="text-lg px-12">I'm an Employee</Button>
            </Link>
            <Link href="/auth?role=curator">
              <Button size="lg" variant="outline" className="text-lg px-12">I'm a Curator</Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          {[
            { icon: Sparkles, title: "Instant Generation", desc: "Paste text, get a full course." },
            { icon: Brain, title: "Active Recall", desc: "Quizzes that adapt to you." },
            { icon: Zap, title: "Roleplay Mode", desc: "Speak with AI scenarios." },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-8 rounded-3xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary mb-6 shadow-sm">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border/50">
        © 2025 Mentora AI. Built for excellence.
      </footer>
    </div>
  );
}
