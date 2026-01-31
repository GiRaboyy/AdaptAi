import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useTrack, useEnrollments, useUpdateProgress, useRecordDrill, useAddNeedsRepeatTag } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic, Volume2, ArrowRight, CheckCircle, XCircle, RotateCcw, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RoleplayVoiceStep } from "@/components/RoleplayVoiceStep";

// TYPES - Backend enforces only mcq/open/roleplay. Legacy quiz mapped to mcq.
// Using string for backwards compatibility with existing data
type StepType = string;

function VoiceOnlyQuestion({ question, onAnswer, currentAnswer }: { 
  question: string; 
  onAnswer: (answer: string) => void;
  currentAnswer: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const hasSpeechSupport = typeof window !== 'undefined' && 
    (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));

  const startListening = () => {
    if (!hasSpeechSupport) {
      setShowTextInput(true);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'ru-RU';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => setIsRecording(true);
    
    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText;
        }
      }
      
      if (finalTranscript) {
        const newAnswer = (currentAnswer ? currentAnswer + ' ' : '') + finalTranscript;
        onAnswer(newAnswer);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setShowTextInput(true);
    };

    recognitionRef.current.onend = () => setIsRecording(false);
    
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold" data-testid="open-question">
        {question}
      </h3>
      
      {hasSpeechSupport && !showTextInput ? (
        <div className="bg-secondary rounded-2xl border border-black p-6 text-center">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground font-medium mb-2">
              Ответьте голосом на этот вопрос
            </p>
            <p className="text-xs text-muted-foreground">
              Нажмите на микрофон и говорите
            </p>
          </div>
          
          <button
            onClick={isRecording ? stopListening : startListening}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all",
              isRecording 
                ? "bg-red-500 animate-pulse border-2 border-red-600" 
                : "bg-[#A6E85B] border-2 border-black hover-elevate"
            )}
            data-testid="button-voice-record"
          >
            <Mic className={cn("w-8 h-8", isRecording ? "text-white" : "text-black")} />
          </button>
          
          <p className="mt-4 text-sm font-medium">
            {isRecording ? "Слушаю..." : "Нажмите для записи"}
          </p>
          
          <button 
            onClick={() => setShowTextInput(true)}
            className="mt-3 text-xs text-muted-foreground underline"
            data-testid="button-switch-text"
          >
            Ввести текстом
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={currentAnswer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Введите ваш ответ..."
            className="w-full p-4 rounded-xl border border-black bg-secondary min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-[#A6E85B] focus:border-[#A6E85B]"
            data-testid="input-open-answer"
          />
          {hasSpeechSupport && (
            <button 
              onClick={() => setShowTextInput(false)}
              className="text-xs text-muted-foreground underline flex items-center gap-1"
              data-testid="button-switch-voice"
            >
              <Mic className="w-3 h-3" /> Голосовой ввод
            </button>
          )}
        </div>
      )}

      {currentAnswer && hasSpeechSupport && !showTextInput && (
        <div className="rounded-xl border border-[#A6E85B] bg-[#A6E85B]/10 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-bold">Ваш ответ:</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onAnswer("")}
              className="text-xs"
              data-testid="button-clear-answer"
            >
              Очистить
            </Button>
          </div>
          <p className="text-muted-foreground" data-testid="text-voice-answer">
            {currentAnswer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Player() {
  const { trackId } = useParams();
  const [, setLocation] = useLocation();
  const { data: trackData, isLoading: isTrackLoading } = useTrack(Number(trackId));
  const { data: enrollments, isLoading: isEnrollmentsLoading } = useEnrollments();
  const { mutate: updateProgress } = useUpdateProgress();
  const { mutate: recordDrill } = useRecordDrill();
  const { mutate: addNeedsRepeatTag } = useAddNeedsRepeatTag();
  const { toast } = useToast();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [feedbackState, setFeedbackState] = useState<'neutral' | 'correct' | 'incorrect'>('neutral');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [drillAttempt, setDrillAttempt] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string; isCorrect: boolean; improvements: string | null } | null>(null);
  const [markedNeedsRepeat, setMarkedNeedsRepeat] = useState(false);
  const [completionResults, setCompletionResults] = useState<{
    successRate: number;
    correctAnswers: number;
    totalAnswers: number;
    scorePoints: number;
    weakTopics: string[];
    strongTopics: string[];
  } | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const enrollment = enrollments?.find(e => e.enrollment.trackId === Number(trackId))?.enrollment;
  
  // Filter out legacy content-type steps (forbidden now)
  const steps = useMemo(() => {
    if (!trackData?.steps) return [];
    return trackData.steps.filter((step: any) => step.type !== 'content');
  }, [trackData?.steps]);
  
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? Math.round(((currentStepIndex + 1) / totalSteps) * 100) : 0;

  useEffect(() => {
    if (enrollment && steps.length > 0) {
      setCurrentStepIndex(Math.min(enrollment.lastStepIndex || 0, steps.length - 1));
    }
  }, [enrollment, steps.length]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
  }, [currentStepIndex]);

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
  };

  const handleNext = async () => {
    setFeedbackState('neutral');
    setSelectedAnswer(null);
    setOpenAnswer("");
    setShowFeedback(false);
    setDrillAttempt(0);
    setEvaluation(null);
    setMarkedNeedsRepeat(false);
    
    if (currentStepIndex < totalSteps - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      updateProgress({ trackId: Number(trackId), stepIndex: nextIndex });
    } else {
      // Курс завершён - рассчитываем успешность
      try {
        const response = await fetch(`/api/enrollments/${trackId}/calculate-success`, {
          method: 'POST',
          credentials: 'include',
        });
        
        const result = await response.json();
        
        // calculate-success УЖЕ установил isCompleted=true, НЕ вызываем updateProgress!
        
        // Показываем результаты НА ЭТОЙ СТРАНИЦЕ
        setCompletionResults(result);
        setShowCompletionModal(true);
      } catch (error) {
        console.error('Failed to calculate success:', error);
        updateProgress({ trackId: Number(trackId), stepIndex: totalSteps, completed: true });
        toast({ title: "Поздравляем!", description: "Вы завершили курс!" });
        setLocation("/app/courses");
      }
    }
  };

  const handleCloseCompletion = () => {
    setShowCompletionModal(false);
    // Перезагружаем страницу курсов, чтобы обновился статус
    window.location.href = "/app/courses";
  };

  const handleRetakeCourse = async () => {
    try {
      // Сбрасываем прогресс курса
      const response = await fetch(`/api/enrollments/${trackId}/reset`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        setShowCompletionModal(false);
        // Перезагружаем страницу, чтобы начать с нуля
        window.location.href = `/app/player/${trackId}`;
      } else {
        toast({ 
          title: "Ошибка", 
          description: "Не удалось сбросить прогресс",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to reset course:', error);
      toast({ 
        title: "Ошибка", 
        description: "Не удалось сбросить прогресс",
        variant: "destructive"
      });
    }
  };

  const handleOpenSubmit = async () => {
    if (!openAnswer.trim() || !currentStep) return;
    
    setIsEvaluating(true);
    const content = currentStep.content as any;
    
    try {
      const response = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: content.scenario || content.question,
          userAnswer: openAnswer,
          idealAnswer: content.ideal_answer || content.ideal,
          context: content.context
        })
      });
      
      const result = await response.json();
      
      // Проверяем статус ответа
      if (!response.ok) {
        // Если ошибка - показываем негативное сообщение
        setEvaluation(result);
        setFeedbackState('incorrect');
        setShowFeedback(true);
        
        recordDrill({
          stepId: currentStep.id,
          trackId: Number(trackId),
          isCorrect: false,
          userAnswer: openAnswer,
          correctAnswer: content.ideal_answer || content.ideal || '',
          tag: currentStep.tag || undefined,
          attemptType: 'initial',
          score: 0
        });
      } else {
        // Нормальная оценка
        setEvaluation(result);
        setFeedbackState(result.isCorrect ? 'correct' : 'incorrect');
        setShowFeedback(true);
        
        recordDrill({
          stepId: currentStep.id,
          trackId: Number(trackId),
          isCorrect: result.isCorrect,
          userAnswer: openAnswer,
          correctAnswer: content.ideal_answer || content.ideal || '',
          tag: currentStep.tag || undefined,
          attemptType: 'initial',
          score: result.score
        });
      }
    } catch (error) {
      // При неожиданной ошибке сети
      console.error('Evaluation network error:', error);
      setEvaluation({ 
        score: 0, 
        feedback: "Ошибка связи. Попробуйте снова.", 
        isCorrect: false, 
        improvements: "Проверьте подключение к интернету" 
      });
      setShowFeedback(true);
      setFeedbackState('incorrect');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Back navigation removed - forward-only flow like Duolingo

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) return;
    const content = currentStep?.content as any;
    
    // Support both correctIndex and correct_index (snake_case from LLM)
    const correctIdx = content.correct_index ?? content.correctIndex ?? 0;
    const isCorrect = selectedAnswer === correctIdx;
    
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
    
    recordDrill({
      stepId: currentStep.id,
      trackId: Number(trackId),
      isCorrect,
      userAnswer: content.options?.[selectedAnswer] || '',
      correctAnswer: content.options?.[correctIdx] || '',
      tag: currentStep.tag || undefined,
      attemptType: drillAttempt === 0 ? 'initial' : drillAttempt === 1 ? 'drill_1' : 'drill_2',
      score: isCorrect ? 10 : 0,
    });

    if (!isCorrect) {
      if (drillAttempt < 2) {
        setDrillAttempt(prev => prev + 1);
      } else if (currentStep.tag) {
        addNeedsRepeatTag({ trackId: Number(trackId), tag: currentStep.tag });
        setMarkedNeedsRepeat(true);
        toast({ 
          title: "Отмечено: нужно повторить",
          description: `Тема "${currentStep.tag}" добавлена для повторения`,
        });
      }
    }
  };

  const handleRetry = () => {
    setSelectedAnswer(null);
    setFeedbackState('neutral');
    setShowFeedback(false);
  };

  if (isTrackLoading || isEnrollmentsLoading) {
    return (
      <div className="h-full grid place-items-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="h-full grid place-items-center">
        <p className="text-muted-foreground">Курс не найден</p>
      </div>
    );
  }

  const content = currentStep.content as any;

  // Если модальное окно результатов открыто - скрываем контент курса
  if (showCompletionModal) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Модальное окно результатов */}
        <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {completionResults && completionResults.successRate >= 80 ? (
                  <span className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-6 h-6" />
                    Поздравляем!
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-orange-700">
                    <XCircle className="w-6 h-6" />
                    Курс завершён
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                {completionResults && completionResults.successRate >= 80
                  ? "Вы успешно завершили курс!"
                  : "Для успешного завершения необходимо набрать минимум 80%"}
              </DialogDescription>
            </DialogHeader>

            {completionResults && (
              <div className="space-y-6 py-4">
                {/* Общий результат */}
                <div className="bg-gray-100 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold">Общий результат</span>
                    <span className={cn(
                      "text-4xl font-bold",
                      completionResults.successRate >= 80 ? "text-green-700" : "text-orange-700"
                    )}>
                      {completionResults.successRate}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-2xl font-bold text-foreground">{completionResults.scorePoints}</p>
                      <p className="text-xs text-muted-foreground">Баллов</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-2xl font-bold text-green-700">{completionResults.correctAnswers}</p>
                      <p className="text-xs text-muted-foreground">Правильных</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-2xl font-bold text-red-700">{completionResults.totalAnswers - completionResults.correctAnswers}</p>
                      <p className="text-xs text-muted-foreground">Неправильных</p>
                    </div>
                  </div>
                </div>

                {/* Сильные стороны */}
                {completionResults.strongTopics && completionResults.strongTopics.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-5 h-5 text-green-700" />
                      <span className="font-semibold text-green-900">Сильные стороны</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {completionResults.strongTopics.map((topic, i) => (
                        <Badge key={i} className="bg-green-100 text-green-700 border-green-300">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Слабые стороны */}
                {completionResults.weakTopics && completionResults.weakTopics.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="w-5 h-5 text-orange-700" />
                      <span className="font-semibold text-orange-900">Нужно повторить</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {completionResults.weakTopics.map((topic, i) => (
                        <Badge key={i} className="bg-orange-100 text-orange-700 border-orange-300">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              {completionResults && completionResults.successRate < 80 && (
                <Button onClick={handleRetakeCourse} variant="default">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Пройти повторно
                </Button>
              )}
              <Button onClick={handleCloseCompletion} variant="secondary">
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar - Duolingo style */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-display font-bold truncate">{trackData?.track.title}</h1>
          <div className="flex items-center gap-2">
            {drillAttempt > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                Drill {drillAttempt}/2
              </Badge>
            )}
            <Badge variant="secondary" data-testid="badge-step">
              {Math.min(currentStepIndex + 1, totalSteps)}/{totalSteps}
            </Badge>
          </div>
        </div>
        <div className="relative">
          <Progress value={progressPct} className={cn("h-3 rounded-full", drillAttempt > 0 && "[&>div]:bg-amber-500")} />
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* MCQ Step - Content steps are forbidden, quiz mapped to mcq on backend */}
          {currentStep.type === 'mcq' && (() => {
            // Get correct index - support both formats
            const correctIdx = content.correct_index ?? content.correctIndex ?? 0;
            const options = content.options || [];
            
            return (
              <div className="space-y-4">
                <h3 className="text-lg font-medium" data-testid="quiz-question">
                  {content.question}
                </h3>
                <div className="space-y-2">
                  {options.map((option: string, idx: number) => {
                    const isCorrectOption = idx === correctIdx;
                    const isSelectedOption = selectedAnswer === idx;
                    const isWrongSelection = showFeedback && isSelectedOption && !isCorrectOption;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => !showFeedback && setSelectedAnswer(idx)}
                        disabled={showFeedback}
                        className={cn(
                          "w-full p-4 rounded-lg border text-left transition-all flex items-center gap-3",
                          isSelectedOption && !showFeedback && "border-primary bg-primary/5",
                          showFeedback && isCorrectOption && "border-green-500 bg-green-50",
                          isWrongSelection && "border-red-500 bg-red-50",
                          !showFeedback && "hover:bg-secondary"
                        )}
                        data-testid={`option-${idx}`}
                      >
                        <span className="flex-1">{option}</span>
                        {showFeedback && isCorrectOption && (
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        )}
                        {isWrongSelection && (
                          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* MCQ Feedback Panel */}
                {showFeedback && (
                  <div className={cn(
                    "p-4 rounded-lg mt-4 space-y-3",
                    feedbackState === 'correct' ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  )}>
                    <div className="flex items-center gap-2">
                      {feedbackState === 'correct' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-bold text-lg">
                        {feedbackState === 'correct' ? "Правильно!" : "Неправильно"}
                      </span>
                    </div>
                    
                    {/* Always show Your Answer and Correct Answer */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-muted-foreground w-32">Ваш ответ:</span>
                        <span className={feedbackState === 'correct' ? "text-green-700" : "text-red-700"}>
                          {options[selectedAnswer!] || 'Не выбран'}
                        </span>
                      </div>
                      {feedbackState === 'incorrect' && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-muted-foreground w-32">Правильный:</span>
                          <span className="text-green-700 font-medium">
                            {options[correctIdx] || 'Не найден'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Explanation (Почему) */}
                    {content.explanation && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Почему:</p>
                        <p className="text-sm text-gray-700">{content.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {(currentStep.type === 'open') && (
            <div className="space-y-4">
              <VoiceOnlyQuestion 
                question={content.question}
                onAnswer={(answer) => setOpenAnswer(answer)}
                currentAnswer={openAnswer}
              />
              
              {/* Open Question Feedback - Enhanced */}
              {evaluation && showFeedback && (
                <div className={cn(
                  "rounded-lg border overflow-hidden",
                  evaluation.isCorrect 
                    ? "bg-green-50 border-green-200" 
                    : "bg-amber-50 border-amber-200"
                )}>
                  {/* Header with score */}
                  <div className={cn(
                    "p-4 flex items-center justify-between",
                    evaluation.isCorrect ? "bg-green-100" : "bg-amber-100"
                  )}>
                    <div className="flex items-center gap-2">
                      {evaluation.isCorrect ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      )}
                      <span className="font-bold text-lg">
                        {evaluation.score >= 8 ? "Отлично!" : evaluation.score >= 6 ? "Хорошо" : "Можно лучше"}
                      </span>
                    </div>
                    <Badge 
                      variant={evaluation.score >= 6 ? "default" : "secondary"}
                      className={cn(
                        "text-lg font-bold px-3 py-1",
                        evaluation.score >= 8 ? "bg-green-600" : evaluation.score >= 6 ? "bg-blue-600" : "bg-amber-600"
                      )}
                    >
                      {evaluation.score}/10
                    </Badge>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* Main feedback */}
                    {evaluation.feedback && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">Оценка ответа:</p>
                        <p className="text-sm text-gray-600">{evaluation.feedback}</p>
                      </div>
                    )}
                    
                    {/* Improvements / Missing points */}
                    {evaluation.improvements && (
                      <div className="bg-white rounded-lg p-3 border border-amber-200">
                        <p className="text-sm font-semibold text-amber-700 mb-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Что можно улучшить:
                        </p>
                        <p className="text-sm text-gray-600">{evaluation.improvements}</p>
                      </div>
                    )}
                    
                    {/* KB_GAP indicator */}
                    {(evaluation as any).kb_gap && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-sm text-blue-700">
                          ℹ️ Ответ требует уточнения у куратора (информация не найдена в базе знаний)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep.type === 'roleplay' && (
            <RoleplayVoiceStep
              scenario={content.scenario || content}
              trackId={Number(trackId)}
              stepId={currentStep.id}
              kbChunkIds={content.kb_refs || []}
              onComplete={(result) => {
                setShowFeedback(true);
                setFeedbackState(result.score_0_10 >= 6 ? 'correct' : 'incorrect');
                
                recordDrill({
                  stepId: currentStep.id,
                  trackId: Number(trackId),
                  isCorrect: result.score_0_10 >= 6,
                  userAnswer: 'Roleplay conversation',
                  correctAnswer: result.better_example || '',
                  tag: currentStep.tag || undefined,
                  attemptType: 'initial',
                  score: result.score_0_10
                });
              }}
              onRetry={() => {
                setShowFeedback(false);
                setFeedbackState('neutral');
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation - Forward only (no back button) */}
      <div className="flex items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          {/* Drill retry button - only for MCQ and only if drill attempts remaining */}
          {showFeedback && feedbackState === 'incorrect' && drillAttempt < 2 && currentStep.type === 'mcq' && (
            <Button variant="outline" onClick={handleRetry} data-testid="button-retry">
              <RotateCcw className="w-4 h-4 mr-2" /> Drill: Попробовать снова
            </Button>
          )}
          
          {/* MCQ check button */}
          {currentStep.type === 'mcq' && !showFeedback && (
            <Button 
              onClick={handleQuizSubmit} 
              disabled={selectedAnswer === null}
              data-testid="button-check"
            >
              Проверить
            </Button>
          )}

          {currentStep.type === 'mcq' && showFeedback && (
            <Button onClick={handleNext} data-testid="button-next">
              {currentStepIndex === totalSteps - 1 ? "Завершить" : "Далее"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {(currentStep.type === 'open') && !showFeedback && (
            <Button 
              onClick={handleOpenSubmit} 
              disabled={!openAnswer.trim() || isEvaluating}
              data-testid="button-submit"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Оценка...
                </>
              ) : (
                <>Проверить</>
              )}
            </Button>
          )}

          {(currentStep.type === 'open') && showFeedback && (
            <Button onClick={handleNext} data-testid="button-next">
              {currentStepIndex === totalSteps - 1 ? "Завершить" : "Далее"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {currentStep.type === 'roleplay' && showFeedback && (
            <Button onClick={handleNext} data-testid="button-next">
              {currentStepIndex === totalSteps - 1 ? "Завершить" : "Далее"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
