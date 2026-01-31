import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Activity, CheckCircle, XCircle, Clock, Eye, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AILogsPage() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['/api/ai/logs', actionFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.append('actionType', actionFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await fetch(`/api/ai/logs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    }
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      generate_course: 'Генерация курса',
      assistant: 'Ассистент',
      evaluate: 'Оценка ответа',
      drill_generate: 'Генерация дрилла',
      test: 'Тест соединения',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      generate_course: 'bg-blue-100 text-blue-800',
      assistant: 'bg-purple-100 text-purple-800',
      evaluate: 'bg-green-100 text-green-800',
      drill_generate: 'bg-orange-100 text-orange-800',
      test: 'bg-gray-100 text-gray-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">AI Debug Logs</h1>
          <p className="text-muted-foreground">
            Мониторинг и отладка AI-взаимодействий
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-2 block">Тип действия</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Все типы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="generate_course">Генерация курса</SelectItem>
                  <SelectItem value="assistant">Ассистент</SelectItem>
                  <SelectItem value="evaluate">Оценка ответа</SelectItem>
                  <SelectItem value="drill_generate">Генерация дрилла</SelectItem>
                  <SelectItem value="test">Тест соединения</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-2 block">Статус</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="success">Успешно</SelectItem>
                  <SelectItem value="error">Ошибка</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {logs && logs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{logs.length}</p>
                <p className="text-sm text-muted-foreground">Всего запросов</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {logs.filter((l: any) => l.status === 'success').length}
                </p>
                <p className="text-sm text-muted-foreground">Успешных</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-red-600">
                  {logs.filter((l: any) => l.status === 'error').length}
                </p>
                <p className="text-sm text-muted-foreground">Ошибок</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            История запросов
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full ${
                      log.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                    } flex items-center justify-center`}>
                      {log.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getActionColor(log.actionType)} variant="secondary">
                          {getActionLabel(log.actionType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.correlationId}
                        </span>
                        {log.kbEnabled && (
                          <Badge variant="outline" className="text-xs">
                            KB ✓
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Clock className="w-3 h-3" />
                        {log.latencyMs}ms
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-foreground">Нет логов</h3>
              <p className="text-muted-foreground max-w-sm">
                Логи AI-взаимодействий появятся здесь после первых запросов
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Детали запроса: {selectedLog?.correlationId}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Meta */}
                <div>
                  <h4 className="font-medium mb-2">Метаданные</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Тип:</span>{' '}
                      <Badge className={getActionColor(selectedLog.actionType)} variant="secondary">
                        {getActionLabel(selectedLog.actionType)}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Статус:</span>{' '}
                      <Badge variant={selectedLog.status === 'success' ? 'default' : 'destructive'}>
                        {selectedLog.status === 'success' ? 'Успешно' : 'Ошибка'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Латентность:</span> {selectedLog.latencyMs}ms
                    </div>
                    <div>
                      <span className="text-muted-foreground">Время:</span>{' '}
                      {new Date(selectedLog.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {selectedLog.trackId && (
                      <div>
                        <span className="text-muted-foreground">Track ID:</span> {selectedLog.trackId}
                      </div>
                    )}
                    {selectedLog.kbEnabled && (
                      <div>
                        <span className="text-muted-foreground">KB:</span> Включена
                      </div>
                    )}
                  </div>
                </div>

                {/* Retrieved Chunks */}
                {selectedLog.retrievedChunkPreviews && selectedLog.retrievedChunkPreviews.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Извлечённые чанки KB ({selectedLog.retrievedChunkPreviews.length})</h4>
                    <div className="space-y-2">
                      {selectedLog.retrievedChunkPreviews.map((preview: string, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-muted text-sm">
                          <pre className="whitespace-pre-wrap font-mono text-xs">{preview}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <h4 className="font-medium mb-2">Промпт</h4>
                  <div className="p-4 rounded-lg bg-muted">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{selectedLog.promptText}</pre>
                  </div>
                </div>

                {/* Response */}
                {selectedLog.responseText && (
                  <div>
                    <h4 className="font-medium mb-2">Ответ</h4>
                    <div className="p-4 rounded-lg bg-muted">
                      <pre className="whitespace-pre-wrap text-sm font-mono">{selectedLog.responseText}</pre>
                    </div>
                  </div>
                )}

                {/* Error */}
                {selectedLog.errorMessage && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-600">Ошибка</h4>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <pre className="whitespace-pre-wrap text-sm font-mono text-red-800">
                        {selectedLog.errorMessage}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
