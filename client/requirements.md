## Packages
framer-motion | Essential for page transitions, progress bars, and Duolingo-like micro-interactions
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind classes efficiently

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["'DM Sans'", "sans-serif"],
  display: ["'Outfit'", "sans-serif"],
}
Voice Integration:
- Using `window.speechSynthesis` for text-to-speech
- Using `window.webkitSpeechRecognition` (with fallback) for speech-to-text
