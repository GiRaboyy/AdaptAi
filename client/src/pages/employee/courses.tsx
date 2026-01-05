import { useState } from "react";
import { useEnrollments } from "@/hooks/use-tracks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  BookOpen, ArrowRight, Plus, CheckCircle, Loader2, 
  Clock, Play, RotateCcw, Search, Filter, Sparkles,
  GraduationCap, Target, Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "all" | "in_progress" | "completed" | "needs_review";

const filters: { key: FilterType; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "in_progress", label: "В процессе" },
  { key: "completed", label: "Завершено" },
  { key: "needs_review", label: "Нужно повторить" },
];

export default function EmployeeCourses() {
  const { data: enrollments, isLoading } = useEnrollments();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const latestInProgress = enrollments?.find(e => !e.enrollment.isCompleted && (e.enrollment.progressPct || 0) > 0);

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {latestInProgress && (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Play className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Продолжить обучение</p>
                  <h2 className="text-xl font-display font-bold mb-2">
                    {latestInProgress.track.title}
                  </h2>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Progress value={latestInProgress.enrollment.progressPct || 0} className="w-24 h-2" />
                      <span className="text-muted-foreground">
                        {latestInProgress.enrollment.progressPct || 0}%
                      </span>
                    </div>
                    <span className="text-muted-foreground">
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
        <Card data-testid="stat-total">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{enrollments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Всего курсов</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-in-progress">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">В процессе</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-completed">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Завершено</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-avg">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgProgress}%</p>
              <p className="text-xs text-muted-foreground">Средний прогресс</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {filters.map((filter) => (
            <Button
              key={filter.key}
              variant={activeFilter === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.key)}
              className="shrink-0"
              data-testid={`filter-${filter.key}`}
            >
              {filter.label}
            </Button>
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
          <Link href="/app/join">
            <Button data-testid="button-join-new">
              <Plus className="w-4 h-4 mr-2" /> Присоединиться
            </Button>
          </Link>
        </div>
      </div>

      {filteredEnrollments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEnrollments.map(({ enrollment, track }) => (
            <CourseCard key={enrollment.id} enrollment={enrollment} track={track} />
          ))}
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">Нет результатов</h3>
            <p className="text-muted-foreground max-w-sm">
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Начните обучение</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Введите код приглашения от вашего куратора, чтобы присоединиться к курсу
            </p>
            <Link href="/app/join">
              <Button size="lg" data-testid="button-join-course">
                <Sparkles className="w-5 h-5 mr-2" /> Присоединиться к курсу
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
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
        <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-0">
          <CheckCircle className="w-3 h-3 mr-1" /> Завершено
        </Badge>
      );
    }
    if (needsReview) {
      return (
        <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0">
          <RotateCcw className="w-3 h-3 mr-1" /> Повторить
        </Badge>
      );
    }
    if (hasStarted) {
      return (
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
          <Clock className="w-3 h-3 mr-1" /> В процессе
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
        <Sparkles className="w-3 h-3 mr-1" /> Новый
      </Badge>
    );
  };

  const getActionButton = () => {
    if (isCompleted) {
      return (
        <Button variant="secondary" className="w-full" data-testid={`button-review-${track.id}`}>
          <RotateCcw className="w-4 h-4 mr-2" /> Повторить
        </Button>
      );
    }
    if (hasStarted) {
      return (
        <Button className="w-full" data-testid={`button-continue-${track.id}`}>
          <Play className="w-4 h-4 mr-2" /> Продолжить
        </Button>
      );
    }
    return (
      <Button className="w-full" data-testid={`button-start-${track.id}`}>
        <ArrowRight className="w-4 h-4 mr-2" /> Начать
      </Button>
    );
  };

  return (
    <Card className="hover-elevate overflow-hidden group" data-testid={`card-course-${track.id}`}>
      <div className="h-2 bg-gradient-to-r from-primary/80 to-primary/40" />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          {getStatusBadge()}
        </div>
        
        <div>
          <h3 className="font-bold text-lg line-clamp-2 mb-1">{track.title}</h3>
          {track.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{track.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
            <div 
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all",
                isCompleted ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Шаг {(enrollment.lastStepIndex || 0) + 1}</span>
          {track.strictMode && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground" />
              <span>Строгий режим</span>
            </>
          )}
        </div>

        <Link href={`/app/player/${track.id}`}>
          {getActionButton()}
        </Link>
      </CardContent>
    </Card>
  );
}
