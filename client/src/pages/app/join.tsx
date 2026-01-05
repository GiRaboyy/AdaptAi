import { useState } from "react";
import { useLocation } from "wouter";
import { useJoinTrack } from "@/hooks/use-tracks";
import { useUser, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function JoinTrack() {
  const [code, setCode] = useState("");
  const { mutate: join, isPending } = useJoinTrack();
  const { mutate: logout } = useLogout();
  const { data: user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;

    join(code, {
      onSuccess: (data) => {
        setLocation(`/app/player/${data.trackId}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-6 flex justify-between items-center max-w-4xl mx-auto w-full">
        <span className="font-display font-bold text-xl">Mentora</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => logout()}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full"
        >
          <div className="w-20 h-20 bg-secondary rounded-3xl flex items-center justify-center text-primary mx-auto mb-8 shadow-inner">
            <span className="text-3xl font-bold">#</span>
          </div>

          <h1 className="text-4xl font-display font-bold mb-4">Enter Join Code</h1>
          <p className="text-muted-foreground mb-8">
            Enter the 6-character code provided by your curator to start your training session.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              className="text-center text-3xl font-mono tracking-widest h-16 rounded-2xl uppercase shadow-lg border-2 border-border focus:border-primary focus:ring-0"
              maxLength={6}
            />
            
            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-lg h-14"
              disabled={code.length < 6 || isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <>Start Training <ArrowRight className="ml-2" /></>}
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
