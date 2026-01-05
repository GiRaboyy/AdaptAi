import { useUser } from "@/hooks/use-auth";
import { useEnrollments } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { BookOpen, Trophy, Target, ArrowRight, Plus, Loader2 } from "lucide-react";

export default function EmployeeOverview() {
  const { data: user } = useUser();
  const { data: enrollments, isLoading } = useEnrollments();

  const completedCount = enrollments?.filter(e => e.enrollment.isCompleted).length || 0;
  const inProgressCount = enrollments?.filter(e => !e.enrollment.isCompleted).length || 0;
  const avgProgress = enrollments?.length 
    ? Math.round(enrollments.reduce((acc, e) => acc + (e.enrollment.progressPct || 0), 0) / enrollments.length)
    : 0;

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">
          Привет, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Добро пожаловать в вашу панель обучения
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-in-progress">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              В процессе
            </CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">активных курсов</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Завершено
            </CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">пройденных курсов</p>
          </CardContent>
        </Card>

        <Card data-testid="card-progress">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Средний прогресс
            </CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgProgress}%</div>
            <Progress value={avgProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-display font-bold">Последние курсы</h2>
        <Link href="/app/courses">
          <Button variant="ghost" size="sm" data-testid="link-all-courses">
            Все курсы <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      {enrollments && enrollments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enrollments.slice(0, 3).map(({ enrollment, track }) => (
            <Card key={enrollment.id} className="hover-elevate" data-testid={`card-course-${track.id}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg line-clamp-2">{track.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Прогресс</span>
                    <span className="font-medium">{enrollment.progressPct || 0}%</span>
                  </div>
                  <Progress value={enrollment.progressPct || 0} className="h-2" />
                </div>
                <Link href={`/app/player/${track.id}`}>
                  <Button className="w-full" data-testid={`button-continue-${track.id}`}>
                    {enrollment.progressPct && enrollment.progressPct > 0 ? "Продолжить" : "Начать"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">Нет активных курсов</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Введите код приглашения, чтобы начать обучение
            </p>
            <Link href="/app/join">
              <Button data-testid="button-join-course">
                <Plus className="w-4 h-4 mr-2" /> Присоединиться к курсу
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
