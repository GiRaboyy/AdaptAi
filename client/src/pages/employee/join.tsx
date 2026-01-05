import { useState } from "react";
import { useLocation } from "wouter";
import { useJoinTrack } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JoinTrack() {
  const [code, setCode] = useState("");
  const { mutate: join, isPending } = useJoinTrack();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;

    join(code, {
      onSuccess: (data) => {
        toast({ title: "Успешно!", description: "Вы присоединились к курсу" });
        setLocation(`/app/player/${data.trackId}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Ошибка", description: err.message || "Неверный код" });
      }
    });
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Hash className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Введите код</CardTitle>
          <CardDescription>
            Введите 6-значный код от вашего куратора
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              className="text-center text-2xl font-mono tracking-widest h-14 uppercase"
              maxLength={6}
              data-testid="input-join-code"
            />
            
            <Button 
              type="submit" 
              size="lg" 
              className="w-full"
              disabled={code.length < 6 || isPending}
              data-testid="button-join"
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Присоединиться
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
