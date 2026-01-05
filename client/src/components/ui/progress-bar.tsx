import { motion } from "framer-motion";

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = Math.min(100, (current / total) * 100);
  
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2 px-1">
        <span>START</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-4 bg-secondary rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 15 }}
        />
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
