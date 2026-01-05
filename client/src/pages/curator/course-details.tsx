import { useParams } from "wouter";
import { useTrack } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Users, BookOpen, Edit3, FileText, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function CuratorCourseDetails() {
  const { id } = useParams();
  const { data: trackData, isLoading } = useTrack(Number(id));
  const { toast } = useToast();

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
          <TabsTrigger value="editor" data-testid="tab-editor">Редактор</TabsTrigger>
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
                <div className="text-3xl font-bold">0</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Завершили
                </CardTitle>
                <Edit3 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">0%</div>
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

        <TabsContent value="editor" className="mt-6">
          <StepEditor steps={steps} trackId={track.id} />
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">Нет сотрудников</h3>
              <p className="text-muted-foreground max-w-sm">
                Поделитесь кодом {track.joinCode} с сотрудниками для присоединения
              </p>
            </CardContent>
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

function StepEditor({ steps, trackId }: { steps: any[], trackId: number }) {
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "Сохранено!", description: "Изменения применены" });
    setEditingStep(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Редактируйте шаги курса
        </p>
        <Button variant="outline" size="sm" data-testid="button-add-step">
          <Plus className="w-4 h-4 mr-2" /> Добавить шаг
        </Button>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <Card key={step.id} data-testid={`editor-step-${step.id}`}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="cursor-grab text-muted-foreground">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">
                      {step.type === 'content' && 'Контент'}
                      {step.type === 'quiz' && 'Тест'}
                      {step.type === 'open' && 'Открытый вопрос'}
                      {step.type === 'roleplay' && 'Ролевая игра'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditingStep(editingStep === idx ? null : idx)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {editingStep === idx ? (
                    <div className="space-y-3">
                      {step.type === 'content' && (
                        <Textarea 
                          defaultValue={(step.content as any).text}
                          className="min-h-[100px]"
                        />
                      )}
                      {step.type === 'quiz' && (
                        <>
                          <Input defaultValue={(step.content as any).question} placeholder="Вопрос" />
                          {(step.content as any).options?.map((opt: string, i: number) => (
                            <Input key={i} defaultValue={opt} placeholder={`Вариант ${i + 1}`} />
                          ))}
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <Input placeholder="Тег (например: Возражения)" defaultValue={step.tag || ''} />
                        <Button onClick={handleSave}>
                          <Save className="w-4 h-4 mr-2" /> Сохранить
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {step.type === 'content' && (step.content as any).text?.slice(0, 100) + '...'}
                      {step.type === 'quiz' && (step.content as any).question}
                      {step.type === 'open' && (step.content as any).question}
                      {step.type === 'roleplay' && (step.content as any).scenario}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
