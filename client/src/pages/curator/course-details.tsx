import { useParams } from "wouter";
import { useTrack } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Users, BookOpen, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export default function CuratorCourseDetails() {
  const { id } = useParams();
  const { data: trackData, isLoading } = useTrack(Number(id));
  const { toast } = useToast();

  const { data: analytics } = useQuery({
    queryKey: ['/api/analytics/track', id],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/track/${id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id
  });

  const copyCode = () => {
    if (trackData?.track.joinCode) {
      navigator.clipboard.writeText(trackData.track.joinCode);
      toast({ title: "Скопировано!", description: `Код ${trackData.track.joinCode}` });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!trackData) {
    return (
      <div className="h-full grid place-items-center">
        <p className="text-muted-foreground">Курс не найден</p>
      </div>
    );
  }

  const { track, steps } = trackData;
  const employeeCount = analytics?.employeeCount || 0;
  const completedCount = analytics?.completedCount || 0;
  const completionRate = employeeCount > 0 ? Math.round((completedCount / employeeCount) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">{track.title}</h1>
          {track.description && (
            <p className="text-muted-foreground">{track.description}</p>
          )}
        </div>
        <Button variant="outline" onClick={copyCode} data-testid="button-copy-code">
          <Copy className="w-4 h-4 mr-2" />
          Код: {track.joinCode}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
          <TabsTrigger value="employees" data-testid="tab-employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">Материалы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Шагов
                </CardTitle>
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{steps.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Сотрудников
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{employeeCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Завершили
                </CardTitle>
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{completionRate}%</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Структура курса</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div 
                    key={step.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                    data-testid={`step-${step.id}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {step.type === 'content' && (step.content as any).text?.slice(0, 50) + '...'}
                        {step.type === 'quiz' && (step.content as any).question}
                        {step.type === 'open' && (step.content as any).question}
                        {step.type === 'roleplay' && (step.content as any).scenario}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {step.type === 'content' && 'Контент'}
                      {step.type === 'quiz' && 'Тест'}
                      {step.type === 'open' && 'Открытый'}
                      {step.type === 'roleplay' && 'Ролевая'}
                    </Badge>
                    {step.tag && <Badge variant="secondary">{step.tag}</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
          <Card>
            {analytics?.employees && analytics.employees.length > 0 ? (
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {analytics.employees.map((emp: any) => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {emp.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-sm text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">{emp.progress}%</p>
                          <p className="text-xs text-muted-foreground">прогресс</p>
                        </div>
                        {emp.isCompleted && (
                          <Badge className="bg-primary/10 text-primary">Завершил</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : (
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Нет сотрудников</h3>
                <p className="text-muted-foreground max-w-sm">
                  Поделитесь кодом {track.joinCode} с сотрудниками для присоединения
                </p>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                База знаний
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-secondary/50 max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm">
                  {track.rawKnowledgeBase}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
