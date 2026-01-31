import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, BookOpen, Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

type EmployeeStats = {
  id: number;
  name: string;
  email: string;
  progress: number;
  isCompleted: boolean;
};

type TrackStats = {
  trackId: number;
  title: string;
  employeeCount: number;
  avgProgress: number;
  completedCount: number;
  accuracy: number;
  employees: EmployeeStats[];
};

type ProblemTopic = {
  tag: string;
  accuracy: number;
  attempts: number;
  errors: number;
};

type AnalyticsData = {
  totalTracks: number;
  totalEmployees: number;
  avgCompletion: number;
  avgAccuracy: number;
  trackStats: TrackStats[];
  problemTopics?: ProblemTopic[];
};

export default function CuratorAnalytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics'],
  });

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const { totalTracks = 0, totalEmployees = 0, avgCompletion = 0, avgAccuracy = 0, trackStats = [] } = analytics || {};

  return (
    <div className="max-w-container mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Аналитика</h1>
        <p className="text-muted-foreground">
          Отслеживайте прогресс сотрудников
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm" data-testid="stat-tracks">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Курсов
            </CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{totalTracks}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-testid="stat-employees">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сотрудников
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-testid="stat-completion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Средний прогресс
            </CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold text-primary">{avgCompletion}%</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-testid="stat-accuracy">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Точность ответов
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{avgAccuracy > 0 ? `${avgAccuracy}%` : '-'}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="courses">По курсам</TabsTrigger>
          <TabsTrigger value="employees">По сотрудникам</TabsTrigger>
          <TabsTrigger value="gaps">Проблемные темы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {trackStats.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Нет данных</h3>
                <p className="text-muted-foreground max-w-sm">
                  Создайте курсы и пригласите сотрудников для получения аналитики
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Активность по курсам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trackStats.map(track => (
                    <div key={track.trackId} className="space-y-2" data-testid={`analytics-track-${track.trackId}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium truncate">{track.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{track.employeeCount} сотр.</Badge>
                          <span className="text-sm text-muted-foreground">{track.avgProgress}%</span>
                        </div>
                      </div>
                      <Progress value={track.avgProgress} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="courses" className="mt-6 space-y-4">
          {trackStats.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  Нет курсов для отображения
                </p>
              </CardContent>
            </Card>
          ) : (
            trackStats.map(track => (
              <Card key={track.trackId} className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>{track.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{track.completedCount}/{track.employeeCount} завершили</Badge>
                      {track.accuracy > 0 && (
                        <Badge variant={track.accuracy >= 70 ? "default" : "destructive"}>
                          {track.accuracy}% точность
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {track.employees.length > 0 ? (
                    <div className="space-y-3">
                      {track.employees.map(emp => (
                        <div key={emp.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">{emp.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">{emp.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={emp.progress} className="w-24 h-2" />
                            <span className="text-sm font-medium w-10">{emp.progress}%</span>
                            {emp.isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Нет сотрудников на этом курсе
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
          {totalEmployees === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Нет сотрудников</h3>
                <p className="text-muted-foreground max-w-sm">
                  Поделитесь кодами курсов для приглашения сотрудников
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Все сотрудники</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trackStats.flatMap(track => 
                    track.employees.map(emp => ({
                      ...emp,
                      trackTitle: track.title,
                      trackId: track.trackId
                    }))
                  ).map((emp, idx) => (
                    <div key={`${emp.trackId}-${emp.id}-${idx}`} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{emp.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.trackTitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={emp.progress} className="w-24 h-2" />
                        <span className="text-sm font-medium w-10">{emp.progress}%</span>
                        {emp.isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Темы, требующие повторения
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!analytics?.problemTopics || analytics.problemTopics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Проблемные темы будут отображаться после прохождения тестов</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.problemTopics.map((topic) => (
                    <div key={topic.tag} className="flex items-center justify-between gap-4 p-4 rounded-lg bg-secondary/30 border" data-testid={`problem-topic-${topic.tag}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">{topic.tag}</p>
                          <p className="text-xs text-muted-foreground">
                            {topic.errors} ошибок из {topic.attempts} попыток
                          </p>
                        </div>
                      </div>
                      <Badge variant={topic.accuracy < 50 ? "destructive" : "secondary"} className="text-sm">
                        {topic.accuracy}% точность
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
