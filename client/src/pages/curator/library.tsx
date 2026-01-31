import { useTracks, useGenerateTrack } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Copy, Users, Loader2, Sparkles, ArrowRight, Upload, FileText, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Map English error codes to Russian messages
const ERROR_MESSAGES: Record<string, string> = {
  'Unauthorized': 'Необходима авторизация. Пожалуйста, войдите в систему.',
  'UNAUTHORIZED': 'Необходима авторизация. Пожалуйста, войдите в систему.',
  'COURSE_LIMIT_REACHED': 'Достигнут лимит курсов. Введите промокод или свяжитесь с владельцем.',
  'EMAIL_NOT_CONFIRMED': 'Подтвердите email перед созданием курса.',
  'FORBIDDEN': 'Доступ запрещён.',
};

function translateError(message: string): string {
  return ERROR_MESSAGES[message] || message;
}

export default function CuratorLibrary() {
  const { data: tracks, isLoading } = useTracks();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-lime" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-foreground">Мои курсы</h1>
          <p className="text-muted-foreground text-sm">
            Управляйте учебными материалами
          </p>
        </div>
        <CreateTrackDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      </div>

      {tracks && tracks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-lime-soft flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8 text-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-foreground">Нет курсов</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              Создайте первый курс на основе ваших учебных материалов
            </p>
            <Button 
              size="lg" 
              onClick={() => setIsDialogOpen(true)} 
              className="bg-lime hover:bg-lime-hover text-foreground"
              data-testid="button-create-first"
            >
              <Plus className="w-5 h-5 mr-2" /> Создать тренинг
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface UploadedFile {
  file: File;
  name: string;
  size: number;
}

type CourseSize = 'S' | 'M' | 'L';

const COURSE_SIZE_OPTIONS: { value: CourseSize; label: string; description: string }[] = [
  { value: 'S', label: 'Короткий', description: '12 вопросов' },
  { value: 'M', label: 'Средний', description: '24 вопроса' },
  { value: 'L', label: 'Большой', description: '36 вопросов' },
];

function CreateTrackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button 
      size="lg" 
      onClick={onClick} 
      className="bg-lime hover:bg-lime-hover text-foreground font-semibold"
      data-testid="button-create-track"
    >
      <Plus className="w-5 h-5 mr-2" /> Создать тренинг
    </Button>
  );
}

function CreateTrackDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [courseSize, setCourseSize] = useState<CourseSize>('M');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const generateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Get JWT auth headers (important for Supabase Auth)
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch('/api/tracks/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          ...authHeaders,
          // Note: Do NOT set Content-Type for FormData - browser sets it automatically with boundary
        },
      });
      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.message || error.code || 'Ошибка генерации';
        throw new Error(translateError(errorMessage));
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tracks'] });
      
      // Show success message with extraction stats
      const fileCount = files.length;
      const totalChars = data.track?.rawKnowledgeBase?.length || 0;
      const description = `✓ Извлечено: ${fileCount} ${fileCount === 1 ? 'файл' : 'файла/файлов'} • ${(totalChars / 1000).toFixed(1)}K символов`;
      
      toast({ title: "Успешно!", description });
      onOpenChange(false);
      resetForm();
      if (data.track?.id) {
        setLocation(`/curator/course/${data.track.id}`);
      }
    },
    onError: (err: Error) => {
      // Показываем ошибку, но нЕ закрываем диалог
      toast({ 
        variant: "destructive", 
        title: "Ошибка", 
        description: err.message || "Не удалось создать тренинг"
      });
    }
  });

  const resetForm = () => {
    setTitle("");
    setFiles([]);
    setCourseSize('M');
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "Ошибка", description: `Файл "${file.name}" слишком большой (макс. 50 МБ)` });
      return false;
    }

    const ext = file.name.toLowerCase().split('.').pop();
    const allowedExts = ['txt', 'md', 'docx', 'pdf'];
    if (!ext || !allowedExts.includes(ext)) {
      toast({ variant: "destructive", title: "Ошибка", description: `Формат файла "${file.name}" не поддерживается. Используйте TXT, MD, DOCX или PDF.` });
      return false;
    }

    return true;
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const validFiles: UploadedFile[] = [];
    Array.from(newFiles).forEach(file => {
      if (validateFile(file)) {
        if (!files.some(f => f.name === file.name && f.size === file.size)) {
          validFiles.push({ file, name: file.name, size: file.size });
        }
      }
    });
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [files]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const truncateName = (name: string): string => {
    if (name.length <= 35) return name;
    return name.slice(0, 18) + '...' + name.slice(-12);
  };

  const hasContent = title.trim() && files.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) return;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('courseSize', courseSize);
    files.forEach(f => {
      formData.append('files', f.file);
    });

    generateMutation.mutate(formData);
  };

  return (
    <>
      <CreateTrackButton onClick={() => onOpenChange(true)} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Создать тренинг</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Загрузите базу знаний и AI создаст уроки
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-foreground">Название тренинга</Label>
              <Input 
                id="title"
                placeholder="Онбординг менеджера по продажам" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="h-12 rounded-xl border-border focus:border-lime focus:ring-lime/25"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Размер курса</Label>
              <div className="grid grid-cols-3 gap-2">
                {COURSE_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCourseSize(option.value)}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-xl border-2 transition-all",
                      courseSize === option.value
                        ? "border-lime bg-lime-soft"
                        : "border-border hover:border-lime/50"
                    )}
                    data-testid={`size-${option.value}`}
                  >
                    <span className="text-xl font-bold text-foreground">{option.value}</span>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center mt-0.5">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">База знаний</Label>
              <p className="text-xs text-muted-foreground">Загрузите документы с материалами</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx,.pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file"
              />
              
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 border-dashed p-6",
                  "flex flex-col items-center justify-center text-center transition-all duration-200",
                  isDragOver 
                    ? "border-lime bg-lime-soft" 
                    : "border-border bg-surface-2 hover:border-lime/50 hover:bg-lime-soft/50"
                )}
                data-testid="dropzone"
              >
                <div className="w-11 h-11 rounded-xl bg-lime-soft flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5 text-foreground" />
                </div>
                <p className="font-medium text-foreground text-sm mb-0.5">Нажмите для загрузки</p>
                <p className="text-xs text-muted-foreground">TXT, MD, DOCX, PDF (до 50 МБ)</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-3">
                  {files.map((file, index) => (
                    <div 
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border"
                    >
                      <FileText className="w-5 h-5 text-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground" title={file.name}>
                          {truncateName(file.name)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base bg-lime hover:bg-lime-hover text-foreground font-semibold rounded-xl" 
              disabled={generateMutation.isPending || !hasContent} 
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="animate-spin mr-2" /> Генерация...</>
              ) : generateMutation.isError ? (
                <>Попробовать ещё раз</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Сгенерировать с AI</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TrackCard({ track }: { track: any }) {
  const { toast } = useToast();
  
  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(track.joinCode);
    toast({ title: "Скопировано!", description: `Код ${track.joinCode}` });
  };

  const employeeCount = track.employeeCount || 0;

  return (
    <Link href={`/curator/course/${track.id}`}>
      <Card 
        className={cn(
          "cursor-pointer h-full bg-white border-border",
          "hover:border-lime hover:shadow-md transition-all duration-200"
        )}
        data-testid={`card-track-${track.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 rounded-xl bg-lime-soft flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-foreground" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
              className="shrink-0 font-mono text-xs h-8 px-2.5 border-border hover:border-lime hover:bg-lime-soft"
              data-testid={`button-copy-${track.id}`}
            >
              {track.joinCode} <Copy className="w-3 h-3 ml-1.5" />
            </Button>
          </div>
          <CardTitle className="text-base line-clamp-2 mt-3 text-foreground">{track.title}</CardTitle>
          {track.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {track.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{employeeCount} {employeeCount === 1 ? 'сотрудник' : employeeCount > 1 && employeeCount < 5 ? 'сотрудника' : 'сотрудников'}</span>
            </div>
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
