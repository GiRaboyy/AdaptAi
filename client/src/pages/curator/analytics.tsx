import { useTracks } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, BookOpen, Target, TrendingUp, AlertTriangle } from "lucide-react";

export default function CuratorAnalytics() {
  const { data: tracks, isLoading } = useTracks();

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const totalTracks = tracks?.length || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Аналитика</h1>
        <p className="text-muted-foreground">
          Отслеживайте прогресс сотрудников
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="stat-tracks">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Курсов
            </CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTracks}</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-employees">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сотрудников
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-completion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Завершений
            </CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">0%</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-accuracy">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Точность
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">-</div>
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
          {totalTracks === 0 ? (
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
            <Card>
              <CardHeader>
                <CardTitle>Активность по курсам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tracks?.map(track => (
                    <div key={track.id} className="space-y-2" data-testid={`analytics-track-${track.id}`}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium truncate">{track.title}</span>
                        <span className="text-sm text-muted-foreground">0 сотрудников</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="courses" className="mt-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Детальная аналитика по курсам появится после активности сотрудников
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
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
        </TabsContent>

        <TabsContent value="gaps" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Темы, требующие повторения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Проблемные темы будут отображаться после прохождения тестов</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
