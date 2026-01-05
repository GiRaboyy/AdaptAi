import { useState } from "react";
import { useParams } from "wouter";
import { useTrack, useUpdateStep } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, Copy, Users, BookOpen, FileText, CheckCircle, 
  Edit2, Save, X, GripVertical, Trash2, Plus 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function CuratorCourseDetails() {
  const { id } = useParams();
  const { data: trackData, isLoading, refetch } = useTrack(Number(id));
  const { toast } = useToast();
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<any>(null);
  const updateStep = useUpdateStep();

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

  const startEditing = (step: any) => {
    setEditingStep(step.id);
    setEditContent(step.content);
  };

  const cancelEditing = () => {
    setEditingStep(null);
    setEditContent(null);
  };

  const saveStep = async (stepId: number) => {
    await updateStep.mutateAsync({ stepId, content: editContent });
    toast({ title: "Сохранено" });
    setEditingStep(null);
    setEditContent(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-[#A6E85B]" />
      </div>
    );
  }

  if (!trackData) {
    return (
      <div className="h-full grid place-items-center">
        <p className="text-white/64">Курс не найден</p>
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
          <h1 className="text-3xl font-bold mb-2 text-white/92">{track.title}</h1>
          {track.description && (
            <p className="text-white/64">{track.description}</p>
          )}
        </div>
        <Button variant="secondary" onClick={copyCode} data-testid="button-copy-code">
          <Copy className="w-4 h-4 mr-2" />
          Код: {track.joinCode}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
          <TabsTrigger value="employees" data-testid="tab-employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">Материалы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-[14px] bg-[#A6E85B]/14 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#A6E85B]" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-white/92">{steps.length}</p>
                  <p className="text-sm text-white/48">Шагов</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-[14px] bg-[#60A5FA]/14 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#60A5FA]" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-white/92">{employeeCount}</p>
                  <p className="text-sm text-white/48">Сотрудников</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-[14px] bg-[#2DD4BF]/14 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#2DD4BF]" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#A6E85B]">{completionRate}%</p>
                  <p className="text-sm text-white/48">Завершили</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-white/92">Структура курса</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <StepItem 
                    key={step.id} 
                    step={step} 
                    index={idx}
                    isEditing={editingStep === step.id}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    onStartEdit={() => startEditing(step)}
                    onCancelEdit={cancelEditing}
                    onSave={() => saveStep(step.id)}
                    isSaving={updateStep.isPending}
                  />
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
                    <div 
                      key={emp.id} 
                      className="flex items-center justify-between p-4 rounded-[14px] bg-white/[0.04] border border-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#A6E85B]/14 flex items-center justify-center">
                          <span className="text-sm font-medium text-[#A6E85B]">
                            {emp.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white/92">{emp.name}</p>
                          <p className="text-sm text-white/48">{emp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium text-white/92">{emp.progress}%</p>
                          <p className="text-xs text-white/48">прогресс</p>
                        </div>
                        {emp.isCompleted && (
                          <Badge variant="success">Завершил</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : (
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-white/48" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-white/92">Нет сотрудников</h3>
                <p className="text-white/64 max-w-sm">
                  Поделитесь кодом <span className="font-mono text-[#A6E85B]">{track.joinCode}</span> с сотрудниками
                </p>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white/92">
                <FileText className="w-5 h-5 text-[#A6E85B]" />
                База знаний
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-[14px] bg-white/[0.04] border border-white/[0.06] max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm text-white/80 font-mono">
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

function StepItem({ 
  step, 
  index, 
  isEditing, 
  editContent,
  setEditContent,
  onStartEdit, 
  onCancelEdit, 
  onSave,
  isSaving
}: { 
  step: any; 
  index: number; 
  isEditing: boolean;
  editContent: any;
  setEditContent: (c: any) => void;
  onStartEdit: () => void; 
  onCancelEdit: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const getStepTypeLabel = (type: string) => {
    switch (type) {
      case 'content': return 'Контент';
      case 'quiz': return 'Тест';
      case 'open': return 'Открытый';
      case 'roleplay': return 'Ролевая';
      default: return type;
    }
  };

  const getStepPreview = (step: any) => {
    const content = step.content;
    switch (step.type) {
      case 'content': return content?.text?.slice(0, 80) + (content?.text?.length > 80 ? '...' : '');
      case 'quiz': return content?.question;
      case 'open': return content?.question;
      case 'roleplay': return content?.scenario;
      default: return '';
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'content': return 'default';
      case 'quiz': return 'info';
      case 'open': return 'warning';
      case 'roleplay': return 'success';
      default: return 'default';
    }
  };

  if (isEditing) {
    return (
      <div 
        className="p-4 rounded-[14px] bg-[#A6E85B]/[0.08] border border-[#A6E85B]/20"
        data-testid={`step-edit-${step.id}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#A6E85B]/20 flex items-center justify-center text-sm font-medium text-[#A6E85B]">
              {index + 1}
            </span>
            <Badge variant={getBadgeVariant(step.type) as any}>
              {getStepTypeLabel(step.type)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCancelEdit}
              data-testid={`button-cancel-${step.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={onSave}
              disabled={isSaving}
              data-testid={`button-save-${step.id}`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </div>
        </div>

        {step.type === 'content' && (
          <Textarea
            value={editContent?.text || ''}
            onChange={(e) => setEditContent({ ...editContent, text: e.target.value })}
            rows={6}
            className="font-mono text-sm"
            data-testid={`textarea-content-${step.id}`}
          />
        )}

        {step.type === 'quiz' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/64 mb-1 block">Вопрос</label>
              <Input
                value={editContent?.question || ''}
                onChange={(e) => setEditContent({ ...editContent, question: e.target.value })}
                data-testid={`input-question-${step.id}`}
              />
            </div>
            <div>
              <label className="text-sm text-white/64 mb-1 block">Варианты ответов</label>
              {editContent?.options?.map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...editContent.options];
                      newOpts[i] = e.target.value;
                      setEditContent({ ...editContent, options: newOpts });
                    }}
                    className={cn(
                      editContent.correctIdx === i && "border-[#A6E85B]"
                    )}
                    data-testid={`input-option-${step.id}-${i}`}
                  />
                  <Button
                    variant={editContent.correctIdx === i ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setEditContent({ ...editContent, correctIdx: i })}
                    data-testid={`button-correct-${step.id}-${i}`}
                  >
                    {editContent.correctIdx === i ? "Верный" : "Выбрать"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step.type === 'open' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/64 mb-1 block">Вопрос</label>
              <Input
                value={editContent?.question || ''}
                onChange={(e) => setEditContent({ ...editContent, question: e.target.value })}
                data-testid={`input-open-question-${step.id}`}
              />
            </div>
            <div>
              <label className="text-sm text-white/64 mb-1 block">Эталонный ответ</label>
              <Textarea
                value={editContent?.idealAnswer || ''}
                onChange={(e) => setEditContent({ ...editContent, idealAnswer: e.target.value })}
                rows={3}
                data-testid={`textarea-ideal-${step.id}`}
              />
            </div>
          </div>
        )}

        {step.type === 'roleplay' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/64 mb-1 block">Сценарий</label>
              <Textarea
                value={editContent?.scenario || ''}
                onChange={(e) => setEditContent({ ...editContent, scenario: e.target.value })}
                rows={3}
                data-testid={`textarea-scenario-${step.id}`}
              />
            </div>
            <div>
              <label className="text-sm text-white/64 mb-1 block">Роль AI</label>
              <Input
                value={editContent?.aiRole || ''}
                onChange={(e) => setEditContent({ ...editContent, aiRole: e.target.value })}
                data-testid={`input-airole-${step.id}`}
              />
            </div>
            <div>
              <label className="text-sm text-white/64 mb-1 block">Роль пользователя</label>
              <Input
                value={editContent?.userRole || ''}
                onChange={(e) => setEditContent({ ...editContent, userRole: e.target.value })}
                data-testid={`input-userrole-${step.id}`}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="group flex items-center gap-3 p-4 rounded-[14px] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.10] transition-colors cursor-pointer"
      onClick={onStartEdit}
      data-testid={`step-${step.id}`}
    >
      <span className="w-7 h-7 rounded-full bg-[#A6E85B]/14 flex items-center justify-center text-sm font-medium text-[#A6E85B]">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-white/92">
          {getStepPreview(step)}
        </p>
      </div>
      <Badge variant={getBadgeVariant(step.type) as any}>
        {getStepTypeLabel(step.type)}
      </Badge>
      {step.tag && <Badge variant="secondary">{step.tag}</Badge>}
      <Button 
        variant="ghost" 
        size="icon" 
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        data-testid={`button-edit-${step.id}`}
      >
        <Edit2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
