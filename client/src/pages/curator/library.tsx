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
    <div className="max-w-6xl mx-auto space-y-8">
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

function CreateTrackDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const generateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/tracks/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка генерации');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tracks'] });
      toast({ title: "Успешно!", description: "Тренинг создан" });
      onOpenChange(false);
      resetForm();
      if (data.track?.id) {
        setLocation(`/curator/course/${data.track.id}`);
      }
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Ошибка", description: err.message || "Не удалось создать тренинг" });
    }
  });

  const resetForm = () => {
    setTitle("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "Ошибка", description: `Файл "${file.name}" слишком большой (макс. 50 МБ)` });
      return false;
    }

    const ext = file.name.toLowerCase().split('.').pop();
    const allowedExts = ['txt', 'md', 'docx'];
    if (!ext || !allowedExts.includes(ext)) {
      toast({ variant: "destructive", title: "Ошибка", description: `Формат файла "${file.name}" не поддерживается. Используйте TXT, MD или DOCX.` });
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

            <div className="space-y-2">
              <Label className="text-base font-medium">База знаний</Label>
              <p className="text-sm text-muted-foreground">Загрузите документы с материалами</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
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
                <p className="text-sm text-muted-foreground">TXT, MD, DOCX (до 50 МБ)</p>
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
                <><Loader2 className="animate-spin mr-2" /> Генерация...</>
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
      <Card className="hover-elevate cursor-pointer h-full border border-black" data-testid={`card-track-${track.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#A6E85B]/20 border border-[#A6E85B] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#A6E85B]" />
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
