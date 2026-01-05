import { useEnrollments } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { BookOpen, ArrowRight, Plus, CheckCircle, Loader2 } from "lucide-react";

export default function EmployeeCourses() {
  const { data: enrollments, isLoading } = useEnrollments();

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
            Все ваши учебные курсы в одном месте
          </p>
        </div>
        <Link href="/app/join">
          <Button data-testid="button-join-new">
            <Plus className="w-4 h-4 mr-2" /> Присоединиться
          </Button>
        </Link>
      </div>

      {enrollments && enrollments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enrollments.map(({ enrollment, track }) => (
            <Card key={enrollment.id} className="hover-elevate" data-testid={`card-course-${track.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-2">{track.title}</CardTitle>
                  {enrollment.isCompleted && (
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle className="w-3 h-3 mr-1" /> Завершено
                    </Badge>
                  )}
                </div>
                {track.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {track.description}
                  </p>
                )}
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
                  <Button 
                    className="w-full" 
                    variant={enrollment.isCompleted ? "secondary" : "default"}
                    data-testid={`button-continue-${track.id}`}
                  >
                    {enrollment.isCompleted 
                      ? "Повторить" 
                      : enrollment.progressPct && enrollment.progressPct > 0 
                        ? "Продолжить" 
                        : "Начать"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <BookOpen className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Нет курсов</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Введите код приглашения от вашего куратора, чтобы начать обучение
            </p>
            <Link href="/app/join">
              <Button size="lg" data-testid="button-join-course">
                <Plus className="w-5 h-5 mr-2" /> Присоединиться к курсу
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
