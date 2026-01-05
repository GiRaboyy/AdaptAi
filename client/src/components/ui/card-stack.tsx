import { motion } from "framer-motion";

export const CardStack = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      {/* Decorative background cards to create depth stack effect */}
      <div className="absolute top-2 left-2 w-full h-full bg-secondary/30 rounded-3xl -z-10 scale-[0.98] origin-top" />
      <div className="absolute top-4 left-4 w-full h-full bg-secondary/10 rounded-3xl -z-20 scale-[0.96] origin-top" />
      
      {/* Main content card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 h-full flex flex-col items-center justify-center text-center relative overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  );
};
