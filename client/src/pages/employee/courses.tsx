import { useState } from "react";
import { useEnrollments, useJoinTrack } from "@/hooks/use-tracks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  BookOpen, ArrowRight, Plus, CheckCircle, Loader2, 
  Clock, Play, RotateCcw, Search, Filter,
  GraduationCap, Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type FilterType = "all" | "in_progress" | "completed" | "needs_review";

const filters: { key: FilterType; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "in_progress", label: "В процессе" },
  { key: "completed", label: "Завершено" },
  { key: "needs_review", label: "Повторить" },
];

export default function EmployeeCourses() {
  const { data: enrollments, isLoading } = useEnrollments();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const joinTrack = useJoinTrack();
  const { toast } = useToast();

  const filteredEnrollments = enrollments?.filter(({ enrollment, track }) => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (activeFilter) {
      case "in_progress":
        return !enrollment.isCompleted && (enrollment.progressPct || 0) > 0;
      case "completed":
        return enrollment.isCompleted;
      case "needs_review":
        return enrollment.needsRepeatTags && enrollment.needsRepeatTags.length > 0;
      default:
        return true;
    }
  }) || [];

  const completedCount = enrollments?.filter(e => e.enrollment.isCompleted).length || 0;
  const inProgressCount = enrollments?.filter(e => !e.enrollment.isCompleted).length || 0;
  const avgProgress = enrollments?.length 
    ? Math.round(enrollments.reduce((acc, e) => acc + (e.enrollment.progressPct || 0), 0) / enrollments.length)
    : 0;

  const latestInProgress = enrollments?.find(e => !e.enrollment.isCompleted && (e.enrollment.progressPct || 0) > 0 && (e.enrollment.progressPct || 0) < 100);

  const handleJoinSubmit = () => {
    if (!joinCode.trim()) return;
    joinTrack.mutate(joinCode.trim(), {
      onSuccess: () => {
        toast({ title: "Курс добавлен" });
        setJoinDialogOpen(false);
        setJoinCode("");
      },
      onError: () => {
        toast({ title: "Неверный код", variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-[#A6E85B]" />
      </div>
    );
  }

  const hasCourses = enrollments && enrollments.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {latestInProgress && (
        <Card className="bg-[#A6E85B]/10 border border-[#A6E85B] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#A6E85B]/30 border border-[#A6E85B] flex items-center justify-center shrink-0">
                  <Play className="w-7 h-7 text-[#A6E85B]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Продолжить обучение</p>
                  <h2 className="text-xl font-bold mb-2">
                    {latestInProgress.track.title}
                  </h2>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Progress value={latestInProgress.enrollment.progressPct || 0} className="w-24" />
                      <span className="text-muted-foreground font-medium">
                        {latestInProgress.enrollment.progressPct || 0}%
                      </span>
                    </div>
                    <span className="text-muted-foreground font-medium">
                      Шаг {(latestInProgress.enrollment.lastStepIndex || 0) + 1}
                    </span>
                  </div>
                </div>
              </div>
              <Link href={`/app/player/${latestInProgress.track.id}`}>
                <Button size="lg" className="shrink-0" data-testid="button-continue-hero">
                  Продолжить <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2 border-[#0a1f12]/20" data-testid="stat-total">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A6E85B]/20 border-2 border-[#A6E85B] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#0a1f12]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0a1f12]">{enrollments?.length || 0}</p>
              <p className="text-xs text-[#0a1f12]/60 font-medium">Всего курсов</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#0a1f12]/20" data-testid="stat-in-progress">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#0a1f12]/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#0a1f12]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0a1f12]">{inProgressCount}</p>
              <p className="text-xs text-[#0a1f12]/60 font-medium">В процессе</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#0a1f12]/20" data-testid="stat-completed">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A6E85B]/20 border-2 border-[#A6E85B] flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#0a1f12]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0a1f12]">{completedCount}</p>
              <p className="text-xs text-[#0a1f12]/60 font-medium">Завершено</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#0a1f12]/20" data-testid="stat-avg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#0a1f12]/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-[#0a1f12]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0a1f12]">{avgProgress}%</p>
              <p className="text-xs text-[#0a1f12]/60 font-medium">Средний прогресс</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0",
                activeFilter === filter.key
                  ? "bg-[#A6E85B]/15 border border-[#A6E85B]/35 text-foreground"
                  : "bg-white border border-border text-muted-foreground hover:border-border-strong"
              )}
              data-testid={`filter-${filter.key}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск курсов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          {hasCourses && (
            <Button 
              variant="outline" 
              onClick={() => setJoinDialogOpen(true)}
              data-testid="button-join-new"
            >
              <Plus className="w-4 h-4 mr-2" /> Присоединиться
            </Button>
          )}
        </div>
      </div>

      {filteredEnrollments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEnrollments.map(({ enrollment, track }) => (
            <CourseCard key={enrollment.id} enrollment={enrollment} track={track} />
          ))}
        </div>
      ) : hasCourses ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2 text-foreground">Нет результатов</h3>
            <p className="text-muted-foreground max-w-sm">
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[#A6E85B]/15 flex items-center justify-center mb-6">
              <GraduationCap className="w-10 h-10 text-[#3D7A1E]" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">У вас пока нет курсов</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Введите код приглашения от вашего куратора, чтобы присоединиться к курсу
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <Input
                placeholder="Введите код курса"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1"
                data-testid="input-join-code-empty"
              />
              <Button 
                onClick={handleJoinSubmit}
                disabled={!joinCode.trim() || joinTrack.isPending}
                data-testid="button-join-course"
              >
                {joinTrack.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Присоединиться</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Присоединиться к курсу</DialogTitle>
            <DialogDescription>
              Введите код приглашения от вашего куратора
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4">
            <Input
              placeholder="Код курса"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              data-testid="input-join-code-modal"
            />
            <Button 
              onClick={handleJoinSubmit}
              disabled={!joinCode.trim() || joinTrack.isPending}
              data-testid="button-join-submit"
            >
              {joinTrack.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Присоединиться
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseCard({ enrollment, track }: { enrollment: any; track: any }) {
  const progress = enrollment.progressPct || 0;
  const isCompleted = enrollment.isCompleted;
  const hasStarted = progress > 0;
  const needsReview = enrollment.needsRepeatTags && enrollment.needsRepeatTags.length > 0;

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <Badge variant="success">
          <CheckCircle className="w-3 h-3 mr-1" /> Завершено
        </Badge>
      );
    }
    if (needsReview) {
      return (
        <Badge variant="warning">
          <RotateCcw className="w-3 h-3 mr-1" /> Повторить
        </Badge>
      );
    }
    if (hasStarted) {
      return (
        <Badge variant="info">
          <Clock className="w-3 h-3 mr-1" /> В процессе
        </Badge>
      );
    }
    return (
      <Badge variant="default">
        Новый
      </Badge>
    );
  };

  const getActionButton = () => {
    if (isCompleted) {
      return (
        <Button variant="outline" size="sm" data-testid={`button-review-${track.id}`}>
          Повторить <RotateCcw className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      );
    }
    if (hasStarted) {
      return (
        <Button variant="outline" size="sm" data-testid={`button-continue-${track.id}`}>
          Продолжить <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      );
    }
    return (
      <Button variant="outline" size="sm" data-testid={`button-start-${track.id}`}>
        Начать <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    );
  };

  return (
    <Card className="overflow-hidden" data-testid={`card-course-${track.id}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="w-11 h-11 rounded-xl bg-[#A6E85B]/15 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[#3D7A1E]" />
          </div>
          {getStatusBadge()}
        </div>
        
        <div>
          <h3 className="font-bold text-base line-clamp-2 mb-1 text-foreground">{track.title}</h3>
          {track.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{track.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <Progress value={progress} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Шаг {(enrollment.lastStepIndex || 0) + 1}
            {track.strictMode && " • Строгий режим"}
          </span>
          <Link href={`/app/player/${track.id}`}>
            {getActionButton()}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
