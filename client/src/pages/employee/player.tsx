import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useTrack, useEnrollments, useUpdateProgress, useRecordDrill, useAddNeedsRepeatTag } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mic, Volume2, ArrowRight, ArrowLeft, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type StepType = 'content' | 'quiz' | 'open' | 'roleplay';

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

  const enrollment = enrollments?.find(e => e.enrollment.trackId === Number(trackId))?.enrollment;
  const steps = trackData?.steps || [];
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

  const handleNext = () => {
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
      updateProgress({ trackId: Number(trackId), stepIndex: totalSteps, completed: true });
      toast({ title: "Поздравляем!", description: "Вы завершили курс!" });
      setLocation("/app/courses");
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
    } catch (error) {
      setEvaluation({ score: 5, feedback: "Ответ принят", isCorrect: true, improvements: null });
      setShowFeedback(true);
      setFeedbackState('correct');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setFeedbackState('neutral');
      setSelectedAnswer(null);
      setOpenAnswer("");
      setShowFeedback(false);
    }
  };

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) return;
    const content = currentStep?.content as any;
    const isCorrect = selectedAnswer === content.correctIndex;
    
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
    
    recordDrill({
      stepId: currentStep.id,
      trackId: Number(trackId),
      isCorrect,
      userAnswer: content.options[selectedAnswer],
      correctAnswer: content.options[content.correctIndex],
      tag: currentStep.tag || undefined,
      attemptType: drillAttempt === 0 ? 'initial' : drillAttempt === 1 ? 'drill_1' : 'drill_2',
      score: isCorrect ? 10 : 0,
    });

    if (!isCorrect) {
      if (drillAttempt < 2) {
        setDrillAttempt(drillAttempt + 1);
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-display font-bold truncate">{trackData?.track.title}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={cn(voiceEnabled && "text-primary")}
              data-testid="button-voice-toggle"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
            <Badge variant="secondary" data-testid="badge-step">
              Шаг {currentStepIndex + 1}/{totalSteps}
            </Badge>
          </div>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {drillAttempt > 0 && (
        <Badge className="mb-4" variant="outline">
          Мини-дрилл ({drillAttempt}/2)
        </Badge>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          {currentStep.type === 'content' && (
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed" data-testid="content-text">
                {content.text}
              </p>
              {voiceEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => speak(content.text)}
                  disabled={isSpeaking}
                  data-testid="button-speak"
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  {isSpeaking ? "Озвучивается..." : "Озвучить"}
                </Button>
              )}
            </div>
          )}

          {currentStep.type === 'quiz' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium" data-testid="quiz-question">
                {content.question}
              </h3>
              <div className="space-y-2">
                {content.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => !showFeedback && setSelectedAnswer(idx)}
                    disabled={showFeedback}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-all",
                      selectedAnswer === idx && !showFeedback && "border-primary bg-primary/5",
                      showFeedback && idx === content.correctIndex && "border-green-500 bg-green-500/10",
                      showFeedback && selectedAnswer === idx && idx !== content.correctIndex && "border-red-500 bg-red-500/10",
                      !showFeedback && "hover:bg-secondary"
                    )}
                    data-testid={`option-${idx}`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {showFeedback && (
                <div className={cn(
                  "p-4 rounded-lg mt-4",
                  feedbackState === 'correct' ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                )}>
                  <div className="flex items-start gap-3">
                    {feedbackState === 'correct' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">
                        {feedbackState === 'correct' ? "Правильно!" : "Неправильно"}
                      </p>
                      {feedbackState === 'incorrect' && (
                        <>
                          <p className="text-sm mt-1">
                            <strong>Правильный ответ:</strong> {content.options[content.correctIndex]}
                          </p>
                          <p className="text-sm mt-1">
                            <strong>Ваш ответ:</strong> {content.options[selectedAnswer!]}
                          </p>
                          {content.explanation && (
                            <p className="text-sm mt-2 text-muted-foreground">{content.explanation}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(currentStep.type === 'open' || currentStep.type === 'roleplay') && (
            <div className="space-y-4">
              <VoiceOnlyQuestion 
                question={content.scenario || content.question}
                onAnswer={(answer) => setOpenAnswer(answer)}
                currentAnswer={openAnswer}
              />
              
              {evaluation && showFeedback && (
                <div className={cn(
                  "p-4 rounded-lg border",
                  evaluation.isCorrect 
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}>
                  <div className="flex items-start gap-3">
                    {evaluation.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-bold">
                          {evaluation.isCorrect ? "Хорошо!" : "Можно лучше"}
                        </p>
                        <Badge 
                          variant={evaluation.score >= 6 ? "default" : "destructive"}
                          className="text-sm font-bold"
                        >
                          {evaluation.score}/10
                        </Badge>
                      </div>
                      <p className="text-sm">{evaluation.feedback}</p>
                      {evaluation.improvements && (
                        <p className="text-sm mt-2 text-muted-foreground">
                          <strong>Рекомендация:</strong> {evaluation.improvements}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>

        <div className="flex items-center gap-2">
          {showFeedback && feedbackState === 'incorrect' && drillAttempt < 2 && (
            <Button variant="outline" onClick={handleRetry} data-testid="button-retry">
              <RotateCcw className="w-4 h-4 mr-2" /> Попробовать снова
            </Button>
          )}
          
          {currentStep.type === 'content' && (
            <Button onClick={handleNext} data-testid="button-next">
              Далее <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {currentStep.type === 'quiz' && !showFeedback && (
            <Button 
              onClick={handleQuizSubmit} 
              disabled={selectedAnswer === null}
              data-testid="button-check"
            >
              Проверить
            </Button>
          )}

          {currentStep.type === 'quiz' && showFeedback && (
            <Button onClick={handleNext} data-testid="button-next">
              {currentStepIndex === totalSteps - 1 ? "Завершить" : "Далее"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {(currentStep.type === 'open' || currentStep.type === 'roleplay') && !showFeedback && (
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

          {(currentStep.type === 'open' || currentStep.type === 'roleplay') && showFeedback && (
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
