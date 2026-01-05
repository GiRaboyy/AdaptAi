import { useTracks, useGenerateTrack } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, Copy, Users, Loader2, Sparkles, ArrowRight, Upload, FileText, X } from "lucide-react";

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
              <Plus className="w-5 h-5 mr-2" /> Создать курс
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateTrackDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [strictMode, setStrictMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: generate, isPending } = useGenerateTrack();
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Ошибка", description: "Файл слишком большой (макс. 5 МБ)" });
      return;
    }

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'docx' || ext === 'doc') {
      toast({ variant: "destructive", title: "Формат не поддерживается", description: "Пожалуйста, конвертируйте .doc/.docx в .txt и загрузите снова" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target?.result as string;
      content = content.replace(/\x00/g, '');
      setFileContent(content);
      setFileName(file.name);
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось прочитать файл" });
    };
    reader.readAsText(file, 'utf-8');
  };

  const removeFile = () => {
    setFileName(null);
    setFileContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const combinedText = [text, fileContent].filter(Boolean).join("\n\n");
  const hasContent = title && combinedText.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) return;

    generate({ title, description, text: combinedText, strictMode }, {
      onSuccess: () => {
        toast({ title: "Успешно!", description: "Курс создан" });
        onOpenChange(false);
        setTitle("");
        setDescription("");
        setText("");
        setFileName(null);
        setFileContent("");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Ошибка", description: "Не удалось создать курс" });
      }
    });
  };

  return (
    <>
      <Button size="lg" onClick={() => onOpenChange(true)} data-testid="button-create-track">
        <Plus className="w-5 h-5 mr-2" /> Создать курс
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать новый курс</DialogTitle>
          <DialogDescription>
            Добавьте текст или загрузите файл с учебными материалами
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название курса</Label>
            <Input 
              id="title"
              placeholder="Например: Работа с возражениями" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              data-testid="input-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Описание (опционально)</Label>
            <Input 
              id="description"
              placeholder="Краткое описание курса" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Загрузить файл (опционально)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file"
            />
            {fileName ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 overflow-hidden">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm truncate min-w-0 flex-1" title={fileName}>
                  {fileName.length > 40 ? fileName.slice(0, 20) + '...' + fileName.slice(-15) : fileName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  className="shrink-0"
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-file"
              >
                <Upload className="w-4 h-4 mr-2" /> Выбрать файл
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Поддерживаются .txt, .md (макс. 5 МБ)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">Текст базы знаний (опционально)</Label>
            <Textarea 
              id="text"
              placeholder="Или вставьте текст учебных материалов здесь..." 
              value={text} 
              onChange={e => setText(e.target.value)}
              className="h-32 resize-none"
              data-testid="input-knowledge"
            />
            <p className="text-xs text-muted-foreground text-right">
              {combinedText.length} символов всего
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/50">
            <div>
              <Label htmlFor="strict">Строго по базе знаний</Label>
              <p className="text-xs text-muted-foreground">Не выдумывать информацию</p>
            </div>
            <Switch 
              id="strict" 
              checked={strictMode}
              onCheckedChange={setStrictMode}
              data-testid="switch-strict"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending || !hasContent} data-testid="button-generate">
            {isPending ? (
              <><Loader2 className="animate-spin mr-2" /> Генерация...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Создать с ИИ</>
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

  return (
    <Link href={`/curator/course/${track.id}`}>
      <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-track-${track.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <Button
              variant="ghost"
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
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>0 сотрудников</span>
            </div>
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
