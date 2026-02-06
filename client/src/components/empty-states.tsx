import { BookOpen, FileText, Users, BarChart3, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Button asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  )
}

export function EmptyCoursesState({ onCreateCourse }: { onCreateCourse?: () => void }) {
  return (
    <EmptyState
      icon={<BookOpen className="h-6 w-6 text-muted-foreground" />}
      title="No courses yet"
      description="Create your first course to get started with AI-powered training."
      actionLabel="Create Course"
      onAction={onCreateCourse}
    />
  )
}

export function EmptyEmployeeCoursesState() {
  return (
    <EmptyState
      icon={<GraduationCap className="h-6 w-6 text-muted-foreground" />}
      title="No courses enrolled"
      description="Join a course using a code from your team leader to start learning."
      actionLabel="Join Course"
      actionHref="/app/join"
    />
  )
}

export function EmptyResourcesState() {
  return (
    <EmptyState
      icon={<FileText className="h-6 w-6 text-muted-foreground" />}
      title="No resources uploaded"
      description="Upload files to generate course content automatically."
    />
  )
}

export function EmptyTeamState() {
  return (
    <EmptyState
      icon={<Users className="h-6 w-6 text-muted-foreground" />}
      title="No team members"
      description="Share your course codes with employees to get started."
    />
  )
}

export function EmptyAnalyticsState() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-6 w-6 text-muted-foreground" />}
      title="No data yet"
      description="Analytics will appear here once employees start completing courses."
    />
  )
}
