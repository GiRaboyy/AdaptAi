import { useTracks, useGenerateTrack } from "@/hooks/use-tracks";
import { useUser, useLogout } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles, LogOut, Copy, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function CuratorDashboard() {
  const { data: user } = useUser();
  const { data: tracks, isLoading } = useTracks();
  const { mutate: logout } = useLogout();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) return <div className="h-screen grid place-items-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-secondary/20 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 font-display font-bold text-xl">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-black">A</span>
            </div>
            <span><span className="text-primary">ADAPT</span> Curator</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">Hello, {user?.name}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Your Tracks</h1>
            <p className="text-muted-foreground">Manage your AI-generated training modules.</p>
          </div>
          
          <CreateTrackDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </div>

        {tracks?.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-border">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">No tracks yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Generate your first AI training track by pasting content from your knowledge base.</p>
            <Button onClick={() => setIsDialogOpen(true)} size="lg">Create Track</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tracks?.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CreateTrackDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const { mutate: generate, isPending } = useGenerateTrack();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !text) return;

    generate({ title, text }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Track generated successfully!" });
        onOpenChange(false);
        setTitle("");
        setText("");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to generate track." });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="shadow-xl shadow-primary/20">
          <Plus className="w-5 h-5 mr-2" /> New Track
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate New Track</DialogTitle>
          <DialogDescription>
            Paste raw text content below. AI will convert it into a lesson, quiz, and roleplay scenario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Track Title</label>
            <Input 
              placeholder="e.g. Sales Objection Handling" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="font-bold text-lg"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Knowledge Base Content</label>
            <Textarea 
              placeholder="Paste training material here..." 
              value={text} 
              onChange={e => setText(e.target.value)}
              className="h-48 resize-none text-base"
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length} characters
            </p>
          </div>
          <Button type="submit" className="w-full h-12" disabled={isPending || !title || !text}>
            {isPending ? (
              <><Loader2 className="animate-spin mr-2" /> Generating Magic...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrackCard({ track }: { track: any }) {
  const { toast } = useToast();
  
  const copyCode = () => {
    navigator.clipboard.writeText(track.joinCode);
    toast({ title: "Copied!", description: `Join code ${track.joinCode} copied to clipboard.` });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 border border-border/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <BookOpen className="w-5 h-5" />
        </div>
        <div 
          onClick={copyCode}
          className="px-3 py-1 bg-secondary rounded-lg text-xs font-mono font-bold text-primary cursor-pointer hover:bg-primary/20 transition-colors flex items-center gap-2"
          title="Click to copy join code"
        >
          {track.joinCode} <Copy className="w-3 h-3" />
        </div>
      </div>
      
      <h3 className="font-display font-bold text-xl mb-2 line-clamp-2">{track.title}</h3>
      <p className="text-muted-foreground text-sm line-clamp-3 mb-6">
        {track.rawKnowledgeBase}
      </p>

      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-4">
        <span>Generated {new Date(track.createdAt).toLocaleDateString()}</span>
      </div>
    </motion.div>
  );
}
