# ADAPT - AI-Powered Employee Onboarding Platform

## Overview

ADAPT is a premium AI-powered onboarding and training platform designed to help organizations create personalized, measurable training experiences for employees. The platform enables curators to generate training courses from their internal documentation, and employees to complete interactive lessons with quizzes, roleplay scenarios, and voice-based practice sessions.

Key features include:
- AI-generated training content from uploaded materials
- Interactive lessons with quizzes, open answers, and roleplay scenarios
- Drill Mode for targeted practice when mistakes are made
- Real analytics for curators to track employee progress
- Russian language UI with TTS voice support
- Role-based access (Curator vs Employee)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled with Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for transitions and micro-interactions
- **UI Components**: Radix UI primitives wrapped with shadcn/ui styling
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx
- **API Pattern**: RESTful JSON APIs defined in `shared/routes.ts`
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Hashing**: scrypt with random salt
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via drizzle-kit with `npm run db:push`

### Key Database Tables
- `users` - User accounts with role (curator/employee)
- `tracks` - Training courses created by curators
- `steps` - Individual lesson steps within tracks (content/quiz/roleplay)
- `enrollments` - Employee enrollment and progress tracking
- `drillAttempts` - Records of practice attempts for analytics

### Role-Based Navigation
- **Employee Routes** (`/app/*`): Overview, My Courses, Profile, Settings, Player
- **Curator Routes** (`/curator/*`): Library, Course Details, Analytics, Profile, Settings
- Sidebar navigation is consistent across all pages within each role

### Voice Integration
- Uses native Browser Web Speech API
- `speechSynthesis` for text-to-speech (Russian TTS)
- `speechRecognition` for speech-to-text input

### AI Integration
- Designed to connect to external Ollama instance via HTTP
- Environment variable: `OLLAMA_BASE_URL`
- Falls back to mock AI responses when unavailable for testability

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- Session store uses PostgreSQL with automatic table creation

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Secret for session encryption (defaults to dev value)
- `OLLAMA_BASE_URL` - Optional AI service endpoint

### Third-Party Services
- No external paid APIs required
- Voice features use browser-native Web Speech API
- AI features mock responses when Ollama is unavailable

### Build & Development
- Development: `npm run dev` (tsx with hot reload)
- Production build: `npm run build` (Vite for client, esbuild for server)
- Database sync: `npm run db:push` (Drizzle Kit)