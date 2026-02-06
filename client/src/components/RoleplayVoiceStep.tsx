/**
 * RoleplayVoiceStep Component
 * 
 * Implements the 6-turn voice-to-voice roleplay training experience:
 * 1. Scenario presentation with TTS
 * 2. Multi-turn dialogue (3 AI + 3 employee turns)
 * 3. Feedback panel with score and improvements
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mic, Volume2, CheckCircle, XCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ScenarioData {
  situation: string;
  employee_role: string;
  goal: string;
  rules: string[];
  ai_role: string;
  turns_total: number;
  ai_opening_line: string;
}

interface ConversationTurn {
  role: 'ai' | 'employee';
  text: string;
  timestamp: number;
}

interface EvaluationResult {
  score_0_10: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  better_example: string;
}

interface RoleplayVoiceStepProps {
  scenario: ScenarioData;
  trackId: number;
  stepId: number;
  kbChunkIds?: number[];
  onComplete: (evaluation: EvaluationResult) => void;
  onRetry: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function RoleplayVoiceStep({
  scenario,
  trackId,
  stepId,
  kbChunkIds = [],
  onComplete,
  onRetry
}: RoleplayVoiceStepProps) {
  // State management
  const [phase, setPhase] = useState<'scenario' | 'dialogue' | 'feedback'>('scenario');
  const [scenarioPlayed, setScenarioPlayed] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0); // 0-5
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isEmployeeRecording, setIsEmployeeRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // Refs
  const recognitionRef = useRef<any>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Speech recognition support check
  const hasSpeechSupport = typeof window !== 'undefined' && 
    (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window));

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  // ============================================================================
  // TTS Functions
  // ============================================================================

  const speak = (text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;
    setIsAiSpeaking(true);
    utterance.onend = () => {
      setIsAiSpeaking(false);
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  const speakScenario = () => {
    const fullText = `
      Ситуация: ${scenario.situation}
      Роль сотрудника: ${scenario.employee_role}
      Цель: ${scenario.goal}
      Правила: ${scenario.rules.join('. ')}
    `;
    speak(fullText, () => {
      setScenarioPlayed(true);
      setTimeout(() => {
        startDialogue();
      }, 2000);
    });
  };

  // ============================================================================
  // Dialogue Flow
  // ============================================================================

  const startDialogue = async () => {
    setPhase('dialogue');
    
    // Add AI opening line to conversation
    const aiTurn: ConversationTurn = {
      role: 'ai',
      text: scenario.ai_opening_line,
      timestamp: Date.now()
    };
    
    setConversationHistory([aiTurn]);
    setCurrentTurnIndex(0);
    
    // Speak AI opening line
    speak(scenario.ai_opening_line, () => {
      // After AI speaks, employee can respond
    });
  };

  const handleEmployeeResponse = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);

    // Add employee turn to conversation
    const employeeTurn: ConversationTurn = {
      role: 'employee',
      text: text.trim(),
      timestamp: Date.now()
    };

    const newHistory = [...conversationHistory, employeeTurn];
    setConversationHistory(newHistory);
    setPartialTranscript('');
    setTextInput('');

    const employeeTurnNumber = Math.floor((currentTurnIndex + 1) / 2) + 1;

    // Check if this was the final employee turn (turn 6)
    if (newHistory.length === 6) {
      // Evaluate the roleplay
      await evaluateRoleplay(newHistory);
      setIsProcessing(false);
      return;
    }

    // Generate next AI turn
    try {
      const response = await fetch('/api/roleplay/next-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trackId,
          stepId,
          scenario,
          conversationHistory: newHistory,
          turnNumber: newHistory.length + 1,
          kbChunkIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI turn');
      }

      const result = await response.json();

      // Add AI turn to conversation
      const aiTurn: ConversationTurn = {
        role: 'ai',
        text: result.reply_text,
        timestamp: Date.now()
      };

      const updatedHistory = [...newHistory, aiTurn];
      setConversationHistory(updatedHistory);
      setCurrentTurnIndex(updatedHistory.length - 1);

      // Speak AI turn
      speak(result.reply_text);

    } catch (error) {
      console.error('Error generating AI turn:', error);
      // Add fallback AI response
      const fallbackTurn: ConversationTurn = {
        role: 'ai',
        text: 'Понятно. Продолжим диалог.',
        timestamp: Date.now()
      };
      const updatedHistory = [...newHistory, fallbackTurn];
      setConversationHistory(updatedHistory);
      speak(fallbackTurn.text);
    } finally {
      setIsProcessing(false);
    }
  };

  const evaluateRoleplay = async (fullConversation: ConversationTurn[]) => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/roleplay/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trackId,
          stepId,
          scenario,
          fullConversation,
          kbChunkIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate roleplay');
      }

      const result: EvaluationResult = await response.json();
      setEvaluation(result);
      setPhase('feedback');
      onComplete(result);

    } catch (error) {
      console.error('Error evaluating roleplay:', error);
      // Fallback evaluation
      const fallbackEval: EvaluationResult = {
        score_0_10: 5,
        verdict: 'Нормально',
        strengths: ['Участвовали в диалоге'],
        improvements: ['Не удалось выполнить полную оценку'],
        better_example: 'Попробуйте снова для детальной оценки.'
      };
      setEvaluation(fallbackEval);
      setPhase('feedback');
      onComplete(fallbackEval);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // Voice Input
  // ============================================================================

  const startVoiceRecording = () => {
    if (!hasSpeechSupport) {
      setShowTextInput(true);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'ru-RU';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => setIsEmployeeRecording(true);

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText;
        } else {
          interimTranscript += transcriptText;
        }
      }

      setPartialTranscript(finalTranscript || interimTranscript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsEmployeeRecording(false);
      setShowTextInput(true);
    };

    recognitionRef.current.onend = () => setIsEmployeeRecording(false);

    recognitionRef.current.start();
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsEmployeeRecording(false);

    // Submit the partial transcript if available
    if (partialTranscript.trim()) {
      handleEmployeeResponse(partialTranscript);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderScenarioPhase = () => (
    <Card className="mb-6">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Сценарий</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={speakScenario}
            disabled={isAiSpeaking}
          >
            <Volume2 className="w-4 h-4 mr-2" />
            {isAiSpeaking ? 'Озвучивается...' : 'Озвучить сценарий'}
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Ситуация</p>
            <p className="text-base">{scenario.situation}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Роль сотрудника</p>
            <p className="text-base">{scenario.employee_role}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Цель</p>
            <p className="text-base">{scenario.goal}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Правила</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {(scenario.rules || []).map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>

        {scenarioPlayed && (
          <p className="text-sm text-muted-foreground italic text-center">
            Диалог начнётся автоматически...
          </p>
        )}

        {!scenarioPlayed && (
          <Button
            onClick={startDialogue}
            className="w-full"
          >
            Начать диалог
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderDialoguePhase = () => {
    // Fix counter bounds - cap at max values
    const employeeCount = conversationHistory.filter(t => t.role === 'employee').length;
    const employeeTurnNumber = Math.min(employeeCount + 1, 3);
    const totalTurns = Math.min(conversationHistory.length, 6);
    const isEmployeeTurn = conversationHistory.length % 2 === 1 && conversationHistory.length < 6;

    return (
      <div className="space-y-4">
        {/* Transcript */}
        <Card>
          <CardContent className="pt-6">
            <div
              ref={transcriptContainerRef}
              className="space-y-3 max-h-96 overflow-y-auto"
            >
              {conversationHistory.map((turn, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex',
                    turn.role === 'ai' ? 'justify-start' : 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg p-3 max-w-[80%]',
                      turn.role === 'ai'
                        ? 'bg-muted text-left'
                        : 'bg-primary/10 text-right'
                    )}
                  >
                    <p className="text-xs font-bold mb-1">
                      {turn.role === 'ai' ? 'Клиент' : 'Вы'}
                    </p>
                    <p className="text-sm">{turn.text}</p>
                    {turn.role === 'ai' && (
                      <button
                        onClick={() => speak(turn.text)}
                        className="text-xs text-muted-foreground underline mt-1"
                      >
                        🔈 Повторить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Реплика {employeeTurnNumber}/3 (вы) • Диалог {totalTurns + 1}/6
            </div>
          </CardContent>
        </Card>

        {/* Voice Input */}
        {isEmployeeTurn && !isProcessing && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              {!showTextInput && hasSpeechSupport ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Нажмите на микрофон и говорите
                  </p>

                  <button
                    onClick={isEmployeeRecording ? stopVoiceRecording : startVoiceRecording}
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all',
                      isEmployeeRecording
                        ? 'bg-destructive animate-pulse border border-destructive'
                        : 'bg-primary border border-border hover:scale-105'
                    )}
                    disabled={isProcessing}
                  >
                    <Mic className={cn('w-8 h-8', isEmployeeRecording ? 'text-white' : 'text-primary-foreground')} />
                  </button>

                  <p className="text-sm font-medium">
                    {isEmployeeRecording ? 'Слушаю...' : 'Нажмите для записи'}
                  </p>

                  {partialTranscript && (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                      <p className="text-sm italic">{partialTranscript}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setShowTextInput(true)}
                    className="text-xs text-muted-foreground underline"
                  >
                    Ввести текстом
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Введите ваш ответ..."
                    className="w-full p-4 rounded-lg border border-input bg-background min-h-[120px] resize-none"
                  />
                  {hasSpeechSupport && (
                    <button
                      onClick={() => setShowTextInput(false)}
                      className="text-xs text-muted-foreground underline"
                    >
                      <Mic className="w-3 h-3 inline mr-1" /> Голосовой ввод
                    </button>
                  )}
                  <Button
                    onClick={() => handleEmployeeResponse(textInput)}
                    disabled={!textInput.trim() || isProcessing}
                    className="w-full"
                  >
                    Отправить
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isProcessing && (
          <div className="text-center py-4">
            <Loader2 className="animate-spin w-6 h-6 mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Проверяю...</p>
          </div>
        )}
      </div>
    );
  };

  const renderFeedbackPhase = () => {
    if (!evaluation) return null;

    const getScoreColor = (score: number) => {
      if (score <= 3) return 'text-destructive';
      if (score <= 6) return 'text-warning';
      if (score <= 8) return 'text-success';
      return 'text-success';
    };

    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 space-y-6">
          {/* Score Badge */}
          <div className="text-center">
            <div className={cn('text-5xl font-bold', getScoreColor(evaluation.score_0_10))}>
              {evaluation.score_0_10}/10
            </div>
            <p className="text-xl font-bold mt-2">{evaluation.verdict}</p>
          </div>

          {/* Strengths */}
          {evaluation.strengths && evaluation.strengths.length > 0 && (
            <div className="bg-success/10 rounded-lg p-4 border border-success/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-semibold text-success">Что получилось</span>
              </div>
              <ul className="space-y-1">
                {evaluation.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-success">• {strength}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {evaluation.improvements && evaluation.improvements.length > 0 && (
            <div className="bg-warning/10 rounded-lg p-4 border border-warning/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="font-semibold text-warning">Что улучшить</span>
              </div>
              <ul className="space-y-1">
                {evaluation.improvements.map((improvement, idx) => (
                  <li key={idx} className="text-sm text-warning">• {improvement}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Better Example */}
          {evaluation.better_example && (
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-primary" />
                <span className="font-semibold text-primary">Пример ответа лучше</span>
              </div>
              <p className="text-sm text-primary italic">"{evaluation.better_example}"</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4 pt-4">
            <Button
              variant="outline"
              onClick={onRetry}
            >
              Попробовать снова
            </Button>
            <Button
              onClick={() => onComplete(evaluation)}
            >
              Далее
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="w-full">
      {phase === 'scenario' && renderScenarioPhase()}
      {phase === 'dialogue' && renderDialoguePhase()}
      {phase === 'feedback' && renderFeedbackPhase()}
    </div>
  );
}
