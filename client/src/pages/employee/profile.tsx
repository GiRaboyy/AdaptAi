import { useUser } from "@/hooks/use-auth";
import { useEnrollments } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trophy, Target, Clock } from "lucide-react";

export default function EmployeeProfile() {
  const { data: user } = useUser();
  const { data: enrollments } = useEnrollments();

  const completedCount = enrollments?.filter(e => e.enrollment.isCompleted).length || 0;
  const inProgressCount = enrollments?.filter(e => !e.enrollment.isCompleted).length || 0;
  const totalCourses = enrollments?.length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-display font-bold" data-testid="text-user-name">
                {user?.name}
              </h1>
              <p className="text-muted-foreground" data-testid="text-user-email">
                {user?.email}
              </p>
              <Badge className="mt-2" variant="secondary">
                Сотрудник
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="stat-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего курсов
            </CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCourses}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-completed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Завершено
            </CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{completedCount}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-in-progress">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              В процессе
            </CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>
      </div>

      {enrollments && enrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Недавняя активность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {enrollments.slice(0, 5).map(({ enrollment, track }) => (
                <div 
                  key={enrollment.id} 
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/50"
                  data-testid={`activity-${track.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{track.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Прогресс: {enrollment.progressPct || 0}%
                      </p>
                    </div>
                  </div>
                  {enrollment.isCompleted ? (
                    <Badge variant="secondary">
                      <Trophy className="w-3 h-3 mr-1" /> Завершено
                    </Badge>
                  ) : (
                    <Badge variant="outline">В процессе</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
