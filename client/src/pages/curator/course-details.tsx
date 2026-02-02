import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useTrack, useUpdateStep, useCreateStep } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Loader2, Copy, Users, BookOpen, FileText, CheckCircle, 
  Edit2, Save, X, Pencil, Plus, Download, AlertCircle,
  ChevronDown, ChevronUp, Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { apiGet, safeFetch } from "@/lib/api-client";

// ============================================================================
// Types for Step Editor
// ============================================================================

interface MCQEditorState {
  type: 'mcq';
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation?: string;
  kb_refs: number[];
  tag?: string;
}

interface OpenEditorState {
  type: 'open';
  question: string;
  rubric: Array<{ score: number; criteria: string }>;
  hasSampleAnswer: boolean;
  sample_good_answer?: string;
  kb_refs: number[];
  tag?: string;
}

interface RoleplayEditorState {
  type: 'roleplay';
  scenario: string;
  user_role: string;
  ai_role: string;
  goal: string;
  rules?: string[];
  turns_total?: number;
  kb_refs: number[];
  tag?: string;
}

type StepEditorState = MCQEditorState | OpenEditorState | RoleplayEditorState;

interface ValidationErrors {
  question?: string;
  options?: string[];
  correctIndex?: string;
  scenario?: string;
  user_role?: string;
  ai_role?: string;
  goal?: string;
  rubric?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function initializeEditorState(type: string, content: any): StepEditorState | null {
  if (!content) return null;
  
  switch (type) {
    case 'mcq':
    case 'quiz':
      const options = content.options || ['', '', '', ''];
      while (options.length < 4) options.push('');
      return {
        type: 'mcq',
        question: content.question || '',
        options: [options[0], options[1], options[2], options[3]] as [string, string, string, string],
        correctIndex: content.correct_index ?? content.correctIdx ?? 0,
        explanation: content.explanation,
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    case 'open':
      return {
        type: 'open',
        question: content.question || '',
        rubric: content.rubric || [
          { score: 0, criteria: 'Неверно' },
          { score: 5, criteria: 'Частично' },
          { score: 10, criteria: 'Верно' }
        ],
        hasSampleAnswer: !!(content.ideal_answer || content.idealAnswer || content.sample_good_answer),
        sample_good_answer: content.ideal_answer || content.idealAnswer || content.sample_good_answer || '',
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    case 'roleplay':
      return {
        type: 'roleplay',
        scenario: content.scenario || '',
        user_role: content.user_role || content.userRole || '',
        ai_role: content.ai_role || content.aiRole || 'Клиент',
        goal: content.goal || content.task || '',
        rules: content.rules || [],
        turns_total: content.turns_total || 6,
        kb_refs: content.kb_refs || [],
        tag: content.tag,
      };
    default:
      return null;
  }
}

function editorStateToContent(state: StepEditorState): any {
  switch (state.type) {
    case 'mcq':
      return {
        question: state.question,
        options: state.options,
        correct_index: state.correctIndex,
        correctIdx: state.correctIndex,
        explanation: state.explanation,
        kb_refs: state.kb_refs,
        tag: state.tag,
      };
    case 'open':
      return {
        question: state.question,
        rubric: state.rubric,
        ideal_answer: state.hasSampleAnswer ? state.sample_good_answer : undefined,
        idealAnswer: state.hasSampleAnswer ? state.sample_good_answer : undefined,
        kb_refs: state.kb_refs,
        tag: state.tag,
      };
    case 'roleplay':
      return {
        scenario: state.scenario,
        user_role: state.user_role,
        userRole: state.user_role,
        ai_role: state.ai_role,
        aiRole: state.ai_role,
        goal: state.goal,
        task: state.goal,
        rules: state.rules,
        turns_total: state.turns_total,
        kb_refs: state.kb_refs,
        tag: state.tag,
      };
  }
}

function validateEditorState(state: StepEditorState): ValidationErrors {
  const errors: ValidationErrors = {};
  
  switch (state.type) {
    case 'mcq':
      if (!state.question.trim()) {
        errors.question = 'Вопрос обязателен';
      }
      const optionErrors: string[] = [];
      state.options.forEach((opt, i) => {
        if (!opt.trim()) optionErrors[i] = `Вариант ${i + 1} пустой`;
      });
      if (optionErrors.length > 0) errors.options = optionErrors;
      // Check for duplicates
      const uniqueOpts = new Set(state.options.map(o => o.toLowerCase().trim()).filter(Boolean));
      if (uniqueOpts.size < state.options.filter(o => o.trim()).length) {
        errors.options = [...(errors.options || []), 'Варианты не должны повторяться'];
      }
      if (state.correctIndex < 0 || state.correctIndex > 3) {
        errors.correctIndex = 'Выберите правильный ответ';
      }
      break;
      
    case 'open':
      if (!state.question.trim()) {
        errors.question = 'Вопрос обязателен';
      }
      if (!state.rubric || state.rubric.length < 1) {
        errors.rubric = 'Критерии оценки обязательны';
      }
      break;
      
    case 'roleplay':
      if (!state.scenario.trim()) {
        errors.scenario = 'Сценарий обязателен';
      }
      if (!state.user_role.trim()) {
        errors.user_role = 'Роль сотрудника обязательна';
      }
      if (!state.ai_role.trim()) {
        errors.ai_role = 'Роль AI обязательна';
      }
      if (!state.goal.trim()) {
        errors.goal = 'Цель диалога обязательна';
      }
      break;
  }
  
  return errors;
}

function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export default function CuratorCourseDetails() {
  const { id } = useParams();
  const { data: trackData, isLoading, refetch } = useTrack(Number(id));
  const { toast } = useToast();
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editState, setEditState] = useState<StepEditorState | null>(null);
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [editMode, setEditMode] = useState(false);
  const [addStepDialogOpen, setAddStepDialogOpen] = useState(false);
  const [newStepType, setNewStepType] = useState<string>("mcq");
  const [newStepState, setNewStepState] = useState<StepEditorState | null>(null);
  const [newStepErrors, setNewStepErrors] = useState<ValidationErrors>({});
  const updateStep = useUpdateStep();
  const createStep = useCreateStep();

  const { data: analytics } = useQuery({
    queryKey: ['/api/analytics/track', id],
    queryFn: async () => {
      const response = await apiGet(`/api/analytics/track/${id}`);
      if (!response.ok) return null;
      return response.data;
    },
    enabled: !!id
  });

  const { data: knowledgeSources, isLoading: isLoadingSources, error: sourcesError } = useQuery({
    queryKey: ['/api/tracks', id, 'sources'],
    queryFn: async () => {
      const response = await apiGet(`/api/tracks/${id}/sources`);
      if (!response.ok) {
        console.error(`[KB Sources] Failed to fetch sources: ${response.status}`);
        throw new Error(response.error?.message || 'Не удалось загрузить файлы');
      }
      console.log(`[KB Sources] Loaded ${response.data.length} sources`);
      return response.data;
    },
    enabled: !!id,
    retry: 2
  });

  // Filter out content steps (legacy/hidden)
  const visibleSteps = useMemo(() => {
    if (!trackData?.steps) return [];
    return trackData.steps.filter((step: any) => step.type !== 'content');
  }, [trackData?.steps]);

  // Check if there are hidden content steps
  const hasHiddenContentSteps = useMemo(() => {
    if (!trackData?.steps) return false;
    return trackData.steps.some((step: any) => step.type === 'content');
  }, [trackData?.steps]);

  const copyCode = () => {
    if (trackData?.track.joinCode) {
      navigator.clipboard.writeText(trackData.track.joinCode);
      toast({ title: "Скопировано!", description: `Код ${trackData.track.joinCode}` });
    }
  };

  const downloadFile = async (sourceId: number, filename: string) => {
    try {
      const response = await safeFetch(`/api/tracks/${id}/sources/${sourceId}/download`);
      
      if (!response.ok) {
        throw new Error(response.error?.message || 'Не удалось скачать файл');
      }
      
      // For file downloads, we need to use the raw fetch response
      const rawResponse = await fetch(`/api/tracks/${id}/sources/${sourceId}/download`, {
        credentials: 'include',
        headers: {
          'Authorization': response.data ? `Bearer ${response.data.token}` : '',
        },
      });
      
      const blob = await rawResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Успешно!", description: `Файл ${filename} скачан` });
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Ошибка", 
        description: "Не удалось скачать файл" 
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const startEditing = (step: any) => {
    const state = initializeEditorState(step.type, step.content);
    if (state) {
      setEditingStep(step.id);
      setEditState(state);
      setEditErrors({});
    }
  };

  const cancelEditing = () => {
    setEditingStep(null);
    setEditState(null);
    setEditErrors({});
  };

  const saveStep = async (stepId: number, stepType: string) => {
    if (!editState) return;
    
    const errors = validateEditorState(editState);
    if (hasValidationErrors(errors)) {
      setEditErrors(errors);
      toast({ 
        variant: "destructive", 
        title: "Ошибка валидации", 
        description: "Заполните все обязательные поля" 
      });
      return;
    }
    
    try {
      const content = editorStateToContent(editState);
      await updateStep.mutateAsync({ stepId, content });
      toast({ title: "Сохранено" });
      setEditingStep(null);
      setEditState(null);
      setEditErrors({});
      refetch();
    } catch (err: any) {
      const message = err?.message || 'Не удалось сохранить';
      toast({ variant: "destructive", title: "Ошибка", description: message });
    }
  };

  // Initialize new step state when type changes
  const handleNewStepTypeChange = (type: string) => {
    setNewStepType(type);
    setNewStepErrors({});
    
    switch (type) {
      case 'mcq':
        setNewStepState({
          type: 'mcq',
          question: '',
          options: ['', '', '', ''],
          correctIndex: 0,
          kb_refs: [],
        });
        break;
      case 'open':
        setNewStepState({
          type: 'open',
          question: '',
          rubric: [
            { score: 0, criteria: 'Неверно' },
            { score: 5, criteria: 'Частично верно' },
            { score: 10, criteria: 'Полностью верно' }
          ],
          hasSampleAnswer: false,
          kb_refs: [],
        });
        break;
      case 'roleplay':
        setNewStepState({
          type: 'roleplay',
          scenario: '',
          user_role: '',
          ai_role: 'Клиент',
          goal: '',
          rules: [],
          turns_total: 6,
          kb_refs: [],
        });
        break;
    }
  };

  const handleAddStep = async () => {
    if (!newStepState) return;
    
    const errors = validateEditorState(newStepState);
    if (hasValidationErrors(errors)) {
      setNewStepErrors(errors);
      toast({ 
        variant: "destructive", 
        title: "Ошибка валидации", 
        description: "Заполните все обязательные поля" 
      });
      return;
    }

    try {
      const order = trackData?.steps?.length ?? 0;
      const content = editorStateToContent(newStepState);
      await createStep.mutateAsync({
        trackId: Number(id),
        type: newStepType,
        content,
        order,
      });
      toast({ title: "Шаг добавлен" });
      setAddStepDialogOpen(false);
      setNewStepType("mcq");
      setNewStepState(null);
      setNewStepErrors({});
      refetch();
    } catch (err: any) {
      const message = err?.message || 'Ошибка при добавлении';
      toast({ title: message, variant: "destructive" });
    }
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
          <h1 className="text-3xl font-bold mb-2 text-foreground">{track.title}</h1>
          {track.description && (
            <p className="text-muted-foreground">{track.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyCode} data-testid="button-copy-code">
            <Copy className="w-4 h-4 mr-2" />
            Код: {track.joinCode}
          </Button>
        </div>
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
                <div className="w-12 h-12 rounded-2xl bg-[#A6E85B]/15 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#3D7A1E]" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{visibleSteps.length}</p>
                  <p className="text-sm text-muted-foreground">Шагов</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{employeeCount}</p>
                  <p className="text-sm text-muted-foreground">Сотрудников</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#3D7A1E]">{completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Завершили</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warning about hidden content steps */}
          {hasHiddenContentSteps && (
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                В курсе есть скрытые content-шаги (устаревший формат). Они не отображаются сотрудникам.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-foreground">Структура курса</CardTitle>
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setAddStepDialogOpen(true);
                        handleNewStepTypeChange('mcq');
                      }}
                      data-testid="button-add-step"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить шаг
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setEditMode(false)}
                      data-testid="button-finish-edit"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Готово
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={() => setEditMode(true)} 
                    data-testid="button-edit-training"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Редактировать тренинг
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {visibleSteps.map((step: any, idx: number) => (
                  <StepItem 
                    key={step.id} 
                    step={step} 
                    index={idx}
                    isEditing={editingStep === step.id}
                    editState={editState}
                    setEditState={setEditState}
                    editErrors={editErrors}
                    onStartEdit={() => startEditing(step)}
                    onCancelEdit={cancelEditing}
                    onSave={() => saveStep(step.id, step.type)}
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
                      className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#A6E85B]/15 flex items-center justify-center">
                          <span className="text-sm font-medium text-[#3D7A1E]">
                            {emp.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{emp.name}</p>
                          <p className="text-sm text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium text-foreground">{emp.progress}%</p>
                          <p className="text-xs text-muted-foreground">прогресс</p>
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
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-foreground">Нет сотрудников</h3>
                <p className="text-muted-foreground max-w-sm">
                  Поделитесь кодом <span className="font-mono text-[#3D7A1E]">{track.joinCode}</span> с сотрудниками
                </p>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-[#3D7A1E]" />
                База знаний
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSources ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Загрузка файлов...</p>
                </div>
              ) : sourcesError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-red-500" />
                  <p className="text-red-500">Ошибка загрузки файлов</p>
                </div>
              ) : knowledgeSources && knowledgeSources.length > 0 ? (
                <div className="space-y-3">
                  {knowledgeSources.map((source: any) => (
                    <div 
                      key={source.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border hover:border-border-strong transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#A6E85B]/15 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#3D7A1E]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate" title={source.filename}>
                            {source.filename}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{formatFileSize(source.sizeBytes)}</span>
                            <span>•</span>
                            <span>{source.extractedCharCount.toLocaleString()} символов</span>
                            {source.pageCount && (
                              <>
                                <span>•</span>
                                <span>{source.pageCount} стр.</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(source.id, source.filename)}
                        className="shrink-0"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Нет загруженных файлов</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addStepDialogOpen} onOpenChange={setAddStepDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить шаг</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Тип шага</Label>
              <Select value={newStepType} onValueChange={handleNewStepTypeChange}>
                <SelectTrigger data-testid="select-step-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Тест (MCQ)</SelectItem>
                  <SelectItem value="open">Открытый вопрос</SelectItem>
                  <SelectItem value="roleplay">Ролевая игра</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* MCQ Editor */}
            {newStepType === "mcq" && newStepState?.type === 'mcq' && (
              <MCQEditor 
                state={newStepState} 
                setState={(s) => setNewStepState(s)} 
                errors={newStepErrors}
              />
            )}

            {/* Open Question Editor */}
            {newStepType === "open" && newStepState?.type === 'open' && (
              <OpenEditor 
                state={newStepState} 
                setState={(s) => setNewStepState(s)} 
                errors={newStepErrors}
              />
            )}

            {/* Roleplay Editor */}
            {newStepType === "roleplay" && newStepState?.type === 'roleplay' && (
              <RoleplayEditor 
                state={newStepState} 
                setState={(s) => setNewStepState(s)} 
                errors={newStepErrors}
              />
            )}

            <Button 
              onClick={handleAddStep} 
              disabled={createStep.isPending || !newStepState}
              className="w-full"
              data-testid="button-create-step"
            >
              {createStep.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Добавить шаг
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// MCQ Editor Component
// ============================================================================
function MCQEditor({ 
  state, 
  setState, 
  errors 
}: { 
  state: MCQEditorState; 
  setState: (s: StepEditorState) => void;
  errors: ValidationErrors;
}) {
  return (
    <div className="space-y-4">
      {/* Question */}
      <div>
        <Label className="text-sm font-medium">Вопрос <span className="text-red-500">*</span></Label>
        <Input
          value={state.question}
          onChange={(e) => setState({ ...state, question: e.target.value })}
          placeholder="Введите вопрос..."
          className={cn(errors.question && "border-red-500")}
          data-testid="input-mcq-question"
        />
        {errors.question && (
          <p className="text-xs text-red-500 mt-1">{errors.question}</p>
        )}
      </div>

      {/* Options with Radio Selection */}
      <div>
        <Label className="text-sm font-medium">Варианты ответов <span className="text-red-500">*</span></Label>
        <p className="text-xs text-muted-foreground mb-2">Выберите правильный вариант</p>
        <div className="space-y-2">
          {state.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctOption"
                checked={state.correctIndex === i}
                onChange={() => setState({ ...state, correctIndex: i })}
                className="w-4 h-4 text-[#3D7A1E] border-gray-300 focus:ring-[#A6E85B]"
              />
              <Input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...state.options] as [string, string, string, string];
                  newOpts[i] = e.target.value;
                  setState({ ...state, options: newOpts });
                }}
                placeholder={`Вариант ${i + 1}`}
                className={cn(
                  state.correctIndex === i && "border-[#A6E85B] bg-[#A6E85B]/5",
                  errors.options?.[i] && "border-red-500"
                )}
                data-testid={`input-mcq-option-${i}`}
              />
            </div>
          ))}
        </div>
        {errors.options && typeof errors.options === 'object' && (
          <p className="text-xs text-red-500 mt-1">
            {Array.isArray(errors.options) ? errors.options.filter(Boolean).join('. ') : ''}
          </p>
        )}
      </div>

      {/* Advanced Section */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
          Дополнительно
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div>
            <Label className="text-sm">Объяснение (опционально)</Label>
            <Textarea
              value={state.explanation || ''}
              onChange={(e) => setState({ ...state, explanation: e.target.value })}
              placeholder="Почему этот ответ правильный..."
              rows={2}
            />
          </div>
          {state.kb_refs && state.kb_refs.length > 0 && (
            <div>
              <Label className="text-sm">KB ссылки</Label>
              <p className="text-xs text-muted-foreground">{state.kb_refs.join(', ')}</p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Open Question Editor Component
// ============================================================================
function OpenEditor({ 
  state, 
  setState, 
  errors 
}: { 
  state: OpenEditorState; 
  setState: (s: StepEditorState) => void;
  errors: ValidationErrors;
}) {
  return (
    <div className="space-y-4">
      {/* Question */}
      <div>
        <Label className="text-sm font-medium">Вопрос <span className="text-red-500">*</span></Label>
        <Textarea
          value={state.question}
          onChange={(e) => setState({ ...state, question: e.target.value })}
          placeholder="Введите открытый вопрос..."
          rows={3}
          className={cn(errors.question && "border-red-500")}
          data-testid="input-open-question"
        />
        {errors.question && (
          <p className="text-xs text-red-500 mt-1">{errors.question}</p>
        )}
      </div>

      {/* Rubric */}
      <div>
        <Label className="text-sm font-medium">Критерии оценки <span className="text-red-500">*</span></Label>
        <div className="space-y-2 mt-2">
          {state.rubric.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="w-12 text-center">{item.score}</Badge>
              <Input
                value={item.criteria}
                onChange={(e) => {
                  const newRubric = [...state.rubric];
                  newRubric[i] = { ...newRubric[i], criteria: e.target.value };
                  setState({ ...state, rubric: newRubric });
                }}
                placeholder={`Критерий для ${item.score} баллов`}
              />
            </div>
          ))}
        </div>
        {errors.rubric && (
          <p className="text-xs text-red-500 mt-1">{errors.rubric}</p>
        )}
      </div>

      {/* Sample Answer Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div>
          <Label className="text-sm font-medium">Есть эталонный ответ</Label>
          <p className="text-xs text-muted-foreground">Показывать пример хорошего ответа</p>
        </div>
        <Switch
          checked={state.hasSampleAnswer}
          onCheckedChange={(checked) => setState({ ...state, hasSampleAnswer: checked })}
        />
      </div>

      {/* Sample Answer (only shown if toggle is ON) */}
      {state.hasSampleAnswer && (
        <div>
          <Label className="text-sm">Эталонный ответ</Label>
          <Textarea
            value={state.sample_good_answer || ''}
            onChange={(e) => setState({ ...state, sample_good_answer: e.target.value })}
            placeholder="Пример хорошего ответа..."
            rows={3}
            data-testid="textarea-open-sample"
          />
        </div>
      )}

      {/* Advanced Section */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
          Дополнительно
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {state.kb_refs && state.kb_refs.length > 0 && (
            <div>
              <Label className="text-sm">KB ссылки</Label>
              <p className="text-xs text-muted-foreground">{state.kb_refs.join(', ')}</p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Roleplay Editor Component
// ============================================================================
function RoleplayEditor({ 
  state, 
  setState, 
  errors 
}: { 
  state: RoleplayEditorState; 
  setState: (s: StepEditorState) => void;
  errors: ValidationErrors;
}) {
  return (
    <div className="space-y-4">
      {/* Scenario */}
      <div>
        <Label className="text-sm font-medium">Сценарий <span className="text-red-500">*</span></Label>
        <Textarea
          value={state.scenario}
          onChange={(e) => setState({ ...state, scenario: e.target.value })}
          placeholder="Опишите ситуацию..."
          rows={3}
          className={cn(errors.scenario && "border-red-500")}
          data-testid="textarea-roleplay-scenario"
        />
        {errors.scenario && (
          <p className="text-xs text-red-500 mt-1">{errors.scenario}</p>
        )}
      </div>

      {/* Roles */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Роль сотрудника <span className="text-red-500">*</span></Label>
          <Input
            value={state.user_role}
            onChange={(e) => setState({ ...state, user_role: e.target.value })}
            placeholder="Например: менеджер"
            className={cn(errors.user_role && "border-red-500")}
            data-testid="input-roleplay-userrole"
          />
          {errors.user_role && (
            <p className="text-xs text-red-500 mt-1">{errors.user_role}</p>
          )}
        </div>
        <div>
          <Label className="text-sm font-medium">Роль AI <span className="text-red-500">*</span></Label>
          <Input
            value={state.ai_role}
            onChange={(e) => setState({ ...state, ai_role: e.target.value })}
            placeholder="Например: клиент"
            className={cn(errors.ai_role && "border-red-500")}
            data-testid="input-roleplay-airole"
          />
          {errors.ai_role && (
            <p className="text-xs text-red-500 mt-1">{errors.ai_role}</p>
          )}
        </div>
      </div>

      {/* Goal - NEW REQUIRED FIELD */}
      <div>
        <Label className="text-sm font-medium">Цель диалога <span className="text-red-500">*</span></Label>
        <Input
          value={state.goal}
          onChange={(e) => setState({ ...state, goal: e.target.value })}
          placeholder="Что должен достичь сотрудник..."
          className={cn(errors.goal && "border-red-500")}
          data-testid="input-roleplay-goal"
        />
        {errors.goal && (
          <p className="text-xs text-red-500 mt-1">{errors.goal}</p>
        )}
      </div>

      {/* Advanced Section */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
          Дополнительно
          <ChevronDown className="w-4 h-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div>
            <Label className="text-sm">Кол-во реплик (дефолт 6)</Label>
            <Input
              type="number"
              value={state.turns_total || 6}
              onChange={(e) => setState({ ...state, turns_total: parseInt(e.target.value) || 6 })}
              min={2}
              max={20}
              className="w-24"
            />
          </div>
          {state.kb_refs && state.kb_refs.length > 0 && (
            <div>
              <Label className="text-sm">KB ссылки</Label>
              <p className="text-xs text-muted-foreground">{state.kb_refs.join(', ')}</p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// Step Item Component - List item and inline editor
// ============================================================================
function StepItem({ 
  step, 
  index, 
  isEditing, 
  editState,
  setEditState,
  editErrors,
  onStartEdit, 
  onCancelEdit, 
  onSave,
  isSaving
}: { 
  step: any; 
  index: number; 
  isEditing: boolean;
  editState: StepEditorState | null;
  setEditState: React.Dispatch<React.SetStateAction<StepEditorState | null>>;
  editErrors: ValidationErrors;
  onStartEdit: () => void; 
  onCancelEdit: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const getStepTypeLabel = (type: string) => {
    switch (type) {
      case 'mcq': return 'Тест';
      case 'quiz': return 'Тест';
      case 'open': return 'Открытый';
      case 'roleplay': return 'Ролевая';
      default: return type;
    }
  };

  const getStepPreview = (step: any) => {
    const content = step.content;
    switch (step.type) {
      case 'mcq': return content?.question;
      case 'quiz': return content?.question;
      case 'open': return content?.question;
      case 'roleplay': return content?.scenario;
      default: return content?.question || content?.scenario || '';
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'mcq': return 'info';
      case 'quiz': return 'info';
      case 'open': return 'warning';
      case 'roleplay': return 'success';
      default: return 'secondary';
    }
  };

  // Check if step has advanced data
  const hasAdvancedData = (step: any) => {
    const content = step.content;
    return (content?.explanation || content?.kb_refs?.length > 0);
  };

  if (isEditing && editState) {
    return (
      <div 
        className="p-4 rounded-xl bg-[#A6E85B]/10 border border-[#A6E85B]/25"
        data-testid={`step-edit-${step.id}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#A6E85B]/20 flex items-center justify-center text-sm font-medium text-[#3D7A1E]">
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

        {/* MCQ Step Editing */}
        {(step.type === 'mcq' || step.type === 'quiz') && editState.type === 'mcq' && (
          <MCQEditor 
            state={editState} 
            setState={(s) => setEditState(s)} 
            errors={editErrors}
          />
        )}

        {/* Open Step Editing */}
        {step.type === 'open' && editState.type === 'open' && (
          <OpenEditor 
            state={editState} 
            setState={(s) => setEditState(s)} 
            errors={editErrors}
          />
        )}

        {/* Roleplay Step Editing */}
        {step.type === 'roleplay' && editState.type === 'roleplay' && (
          <RoleplayEditor 
            state={editState} 
            setState={(s) => setEditState(s)} 
            errors={editErrors}
          />
        )}
      </div>
    );
  }

  // Compact list view
  return (
    <div 
      className="group flex items-center gap-3 p-4 rounded-xl bg-muted border border-border hover:border-border-strong transition-colors cursor-pointer"
      onClick={onStartEdit}
      data-testid={`step-${step.id}`}
    >
      <span className="w-7 h-7 rounded-full bg-[#A6E85B]/15 flex items-center justify-center text-sm font-medium text-[#3D7A1E]">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-foreground">
          {getStepPreview(step)}
        </p>
      </div>
      <Badge variant={getBadgeVariant(step.type) as any}>
        {getStepTypeLabel(step.type)}
      </Badge>
      {step.tag && <Badge variant="secondary">{step.tag}</Badge>}
      {hasAdvancedData(step) && (
        <span title="Есть доп. настройки">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </span>
      )}
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
