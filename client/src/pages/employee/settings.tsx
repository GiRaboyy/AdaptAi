import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Volume2, Moon, Bell } from "lucide-react";
import { useState } from "react";

export default function EmployeeSettings() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Настройки</h1>
        <p className="text-muted-foreground">
          Настройте приложение под себя
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Голосовые настройки
          </CardTitle>
          <CardDescription>
            Настройте озвучку и голосовой ввод
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="voice-auto">Озвучка по умолчанию</Label>
              <p className="text-sm text-muted-foreground">
                Автоматически озвучивать текст уроков
              </p>
            </div>
            <Switch 
              id="voice-auto" 
              checked={voiceEnabled}
              onCheckedChange={setVoiceEnabled}
              data-testid="switch-voice"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Внешний вид
          </CardTitle>
          <CardDescription>
            Настройте тему приложения
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode">Темная тема</Label>
              <p className="text-sm text-muted-foreground">
                Переключить на темную цветовую схему
              </p>
            </div>
            <Switch 
              id="dark-mode" 
              checked={darkMode}
              onCheckedChange={setDarkMode}
              data-testid="switch-dark-mode"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
          <CardDescription>
            Настройте уведомления о курсах
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Уведомления о курсах</Label>
              <p className="text-sm text-muted-foreground">
                Получать напоминания о незавершенных курсах
              </p>
            </div>
            <Switch 
              id="notifications" 
              checked={notifications}
              onCheckedChange={setNotifications}
              data-testid="switch-notifications"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
