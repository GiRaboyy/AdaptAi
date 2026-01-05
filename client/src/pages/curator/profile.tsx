import { useUser } from "@/hooks/use-auth";
import { useTracks } from "@/hooks/use-tracks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, BarChart3 } from "lucide-react";

export default function CuratorProfile() {
  const { data: user } = useUser();
  const { data: tracks } = useTracks();

  const totalTracks = tracks?.length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                {user?.name?.charAt(0).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-display font-bold" data-testid="text-user-name">
                {user?.name}
              </h1>
              <p className="text-muted-foreground" data-testid="text-user-email">
                {user?.email}
              </p>
              <Badge className="mt-2">Куратор</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="stat-courses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Курсов создано
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
              Средняя успеваемость
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">-</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
