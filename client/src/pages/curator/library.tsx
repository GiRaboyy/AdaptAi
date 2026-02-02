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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { apiPostForm } from "@/lib/api-client";

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
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Мои курсы</h1>
          <p className="text-muted-foreground">
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Нет курсов</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Создайте первый курс на основе ваших учебных материалов
            </p>
            <Button size="lg" onClick={() => setIsDialogOpen(true)} data-testid="button-create-first">
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
      // Use centralized API client with automatic auth header injection
      const response = await apiPostForm('/api/tracks/generate', formData);
      
      if (!response.ok) {
        const errorMessage = response.error?.message || response.error?.code || 'Ошибка генерации';
        throw new Error(translateError(errorMessage));
      }
      
      return response.data;
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
      <Button size="lg" onClick={() => onOpenChange(true)} data-testid="button-create-track">
        <Plus className="w-5 h-5 mr-2" /> Создать тренинг
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Создать тренинг</DialogTitle>
            <DialogDescription>
              Загрузите базу знаний и AI создаст уроки
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">Название тренинга</Label>
              <Input 
                id="title"
                placeholder="Онбординг менеджера по продажам" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="h-11"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Размер курса</Label>
              <div className="grid grid-cols-3 gap-2">
                {COURSE_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCourseSize(option.value)}
                    className={`
                      flex flex-col items-center p-3 rounded-lg border-2 transition-all
                      ${courseSize === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                    data-testid={`size-${option.value}`}
                  >
                    <span className="text-2xl font-bold text-foreground">{option.value}</span>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">База знаний</Label>
              <p className="text-sm text-muted-foreground">Загрузите документы с материалами</p>
              
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
                className={`
                  relative cursor-pointer rounded-xl border-2 border-dashed p-8
                  flex flex-col items-center justify-center text-center
                  transition-all duration-200
                  ${isDragOver 
                    ? 'border-primary bg-primary/10' 
                    : 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                  }
                `}
                data-testid="dropzone"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-foreground mb-1">Нажмите для загрузки</p>
                <p className="text-sm text-muted-foreground">TXT, MD, DOCX, PDF (до 50 МБ)</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  {files.map((file, index) => (
                    <div 
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={file.name}>
                          {truncateName(file.name)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="shrink-0"
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
              className="w-full h-12 text-base" 
              disabled={generateMutation.isPending || !hasContent} 
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="animate-spin mr-2" /> Извлечение текста и генерация...</>
              ) : generateMutation.isError ? (
                <>Попробовать ещё раз</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Сгенерировать тренинг с AI</>
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
      <Card className="hover-elevate cursor-pointer h-full shadow-sm hover:shadow-md transition-all" data-testid={`card-track-${track.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
              className="shrink-0 font-mono text-xs"
              data-testid={`button-copy-${track.id}`}
            >
              {track.joinCode} <Copy className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <CardTitle className="text-lg line-clamp-2 mt-3">{track.title}</CardTitle>
          {track.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {track.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-1">
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
