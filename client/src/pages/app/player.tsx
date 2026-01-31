import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useTrack, useEnrollments, useUpdateProgress, useRecordDrill } from "@/hooks/use-tracks";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CardStack } from "@/components/ui/card-stack";
import { Loader2, Mic, ArrowRight, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { clsx } from "clsx";

// TYPES - Backend enforces only mcq/open/roleplay. Content is FORBIDDEN.
type StepType = 'mcq' | 'open' | 'roleplay';

export default function Player() {
  const { trackId } = useParams();
  const [, setLocation] = useLocation();
  const { data: trackData, isLoading: isTrackLoading } = useTrack(Number(trackId));
  const { data: enrollments, isLoading: isEnrollmentsLoading } = useEnrollments();
  const { mutate: updateProgress } = useUpdateProgress();
  const { mutate: recordDrill } = useRecordDrill();
  const { toast } = useToast();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [feedbackState, setFeedbackState] = useState<'neutral' | 'correct' | 'incorrect'>('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Derive current state from data
  const enrollment = enrollments?.find(e => e.enrollment.trackId === Number(trackId))?.enrollment;
  const steps = trackData?.steps || [];
  const currentStep = steps[currentStepIndex];
  
  // Sync local state with enrollment progress on load
  useEffect(() => {
    if (enrollment && steps.length > 0) {
      setCurrentStepIndex(Math.min(enrollment.lastStepIndex || 0, steps.length - 1));
    }
  }, [enrollment, steps.length]);

  // Voice Synthesis Setup
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster for modern feel
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
  };

  // Speech Recognition Setup (Simple)
  const recognitionRef = useRef<any>(null);
  
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ variant: "destructive", title: "Error", description: "Browser does not support speech recognition." });
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    
    recognitionRef.current.onstart = () => setIsSpeaking(true);
    recognitionRef.current.onend = () => setIsSpeaking(false);
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTranscript(transcript);
      handleRoleplaySubmission(transcript);
    };
    
    recognitionRef.current.start();
  };

  const handleNext = () => {
    window.speechSynthesis.cancel();
    setFeedbackState('neutral');
    setTranscript("");
    
    if (currentStepIndex >= steps.length - 1) {
      // Complete
      updateProgress({ 
        trackId: Number(trackId),
        stepIndex: currentStepIndex, 
        completed: true 
      });
      setLocation("/app/join"); // Or a success screen
      toast({ title: "Track Completed!", description: "Great job on finishing the training." });
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      updateProgress({ 
        trackId: Number(trackId),
        stepIndex: nextIndex 
      });
    }
  };

  const handleQuizSubmission = (selectedIndex: number) => {
    const content = currentStep.content as any;
    // Support both correctIndex and correct_index for backwards compatibility
    const correctIdx = content.correct_index ?? content.correctIndex;
    const isCorrect = selectedIndex === correctIdx;

    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
      setTimeout(() => handleNext(), 1500); // Auto advance on correct
    }
    
    recordDrill({
      stepId: currentStep.id,
      trackId: Number(trackId),
      isCorrect,
      score: isCorrect ? 10 : 0
    });
  };

  const handleRoleplaySubmission = (spokenText: string) => {
    // Basic fuzzy match simulation for demo - in real app, use AI to grade
    // For now, always "pass" if they say enough words (>3)
    const passed = spokenText.split(" ").length > 3;
    
    setFeedbackState(passed ? 'correct' : 'incorrect');
    
    if (passed) {
      setTimeout(() => handleNext(), 2000);
    }

    recordDrill({
      stepId: currentStep.id,
      trackId: Number(trackId),
      isCorrect: passed,
      userAnswer: spokenText,
      score: passed ? 10 : 0
    });
  };

  if (isTrackLoading || isEnrollmentsLoading || !currentStep) {
    return <div className="h-screen bg-secondary/30 grid place-items-center"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>;
  }

  return (
    <div className="h-screen w-full bg-secondary/30 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <div className="w-full max-w-2xl flex-1 flex flex-col justify-between py-6">
        
        {/* Top: Progress */}
        <ProgressBar current={currentStepIndex} total={steps.length} />

        {/* Center: Content Card */}
        <div className="flex-1 max-h-[600px] w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="h-full"
            >
              <CardStack className="h-full flex flex-col">
                {/* Step Content Switcher - no content steps allowed */}
                {currentStep.type === 'mcq' && (
                  <QuizStep 
                    content={currentStep.content as any} 
                    onAnswer={handleQuizSubmission}
                    feedback={feedbackState}
                  />
                )}
                {currentStep.type === 'open' && (
                  <QuizStep 
                    content={currentStep.content as any} 
                    onAnswer={handleQuizSubmission}
                    feedback={feedbackState}
                  />
                )}
                {currentStep.type === 'roleplay' && (
                  <RoleplayStep 
                    content={currentStep.content as any} 
                    onRecord={startListening}
                    isRecording={isSpeaking} // re-using state name
                    transcript={transcript}
                    feedback={feedbackState}
                  />
                )}
              </CardStack>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom: Actions */}
        <div className="h-20 flex items-center justify-center mt-8">
          {/* No content step handling - all steps are interactive */}
          
          {/* Feedback Overlays for Quiz/Roleplay */}
          {feedbackState === 'incorrect' && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-0 left-0 w-full bg-destructive text-destructive-foreground p-6 rounded-t-3xl flex items-center justify-between max-w-2xl mx-auto left-0 right-0"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-full"><XCircle className="w-6 h-6" /></div>
                <div>
                  <h4 className="font-bold text-lg">Not quite right</h4>
                  <p className="text-sm opacity-90">Review the material and try again.</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => setFeedbackState('neutral')}>
                Try Again
              </Button>
            </motion.div>
          )}

          {feedbackState === 'correct' && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-0 left-0 w-full bg-green-500 text-white p-6 rounded-t-3xl flex items-center justify-between max-w-2xl mx-auto left-0 right-0"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-full"><CheckCircle className="w-6 h-6" /></div>
                <div>
                  <h4 className="font-bold text-lg">Excellent!</h4>
                  <p className="text-sm opacity-90">Moving to next step...</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---
// NOTE: ContentStep removed - content type is FORBIDDEN

function QuizStep({ content, onAnswer, feedback }: { content: { question: string, options: string[], correctIndex: number, correct_index?: number }, onAnswer: (idx: number) => void, feedback: string }) {
  // Support both correctIndex and correct_index for backwards compatibility
  const correctIdx = content.correct_index ?? content.correctIndex;
  return (
    <div className="flex flex-col h-full w-full">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-left mb-6">Quiz</h2>
      <h3 className="text-2xl font-display font-bold text-left mb-8">{content.question}</h3>
      
      <div className="space-y-3 w-full">
        {content.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => feedback === 'neutral' && onAnswer(i)}
            disabled={feedback !== 'neutral'}
            className={clsx(
              "w-full p-4 rounded-xl border-2 text-left text-lg font-medium transition-all duration-200",
              feedback === 'neutral' && "border-border hover:bg-secondary/50 hover:border-primary/50",
              feedback === 'correct' && i === correctIdx && "bg-green-100 border-green-500 text-green-800",
              feedback === 'incorrect' && "opacity-50"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoleplayStep({ content, onRecord, isRecording, transcript, feedback }: { content: { scenario: string, ideal_answer: string }, onRecord: () => void, isRecording: boolean, transcript: string, feedback: string }) {
  return (
    <div className="flex flex-col h-full items-center text-center">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-8">Roleplay Scenario</h2>
      
      <p className="text-xl text-muted-foreground mb-4">The customer says:</p>
      <div className="bg-secondary/50 p-6 rounded-2xl mb-8 w-full">
        <p className="text-2xl font-display font-bold italic">"{content.scenario}"</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {transcript ? (
           <div className="mb-6 w-full text-left bg-primary/5 p-4 rounded-xl border border-primary/20">
             <span className="text-xs font-bold text-primary uppercase block mb-1">You said:</span>
             <p className="text-lg">{transcript}</p>
           </div>
        ) : (
          <p className="text-muted-foreground mb-6">Tap the mic and respond naturally...</p>
        )}

        <Button 
          size="lg" 
          variant={isRecording ? "destructive" : "default"}
          className={clsx(
            "h-24 w-24 rounded-full shadow-2xl transition-all duration-300", 
            isRecording ? "scale-110 ring-4 ring-destructive/30" : "hover:scale-105"
          )}
          onClick={onRecord}
          disabled={feedback !== 'neutral'}
        >
          {isRecording ? <div className="w-3 h-3 bg-white rounded-sm animate-pulse" /> : <Mic className="w-8 h-8" />}
        </Button>
      </div>
    </div>
  );
}
