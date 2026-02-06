import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  Upload,
  Sparkles,
  BarChart3,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Загрузите",
    description: "Загрузите учебные материалы — PDF, документы или просто название курса.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Генерация",
    description: "AI автоматически создаёт тесты, открытые вопросы и голосовые ролевые сценарии.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Отслеживание",
    description: "Следите за прогрессом сотрудников, оценками и выявляйте пробелы в знаниях.",
  },
];

const features = [
  "AI-генерация тестов с выбором ответа",
  "Оценка открытых ответов",
  "Голосовые ролевые сценарии",
  "Отслеживание прогресса в реальном времени",
  "Подробная аналитика",
  "Простой шаринг кодов курсов",
];

const logos = [
  "Яндекс",
  "Сбер",
  "Тинькофф",
  "VK",
  "Авито",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ADAPT</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth">Войти</Link>
            </Button>
            <Button asChild>
              <Link href="/auth">Начать</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          AI-обучение для бизнеса — просто и эффективно
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          Превратите учебные материалы в интерактивные курсы за минуты. 
          Отслеживайте прогресс сотрудников и улучшайте результаты на основе данных.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/auth">
              Начать бесплатно
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/curator/courses">Демо</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Как это работает</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.number} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <span className="absolute right-4 top-4 text-6xl font-bold text-muted/20">
                    {step.number}
                  </span>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold">
                Всё необходимое для эффективного обучения
              </h2>
              <p className="mb-8 text-muted-foreground">
                От создания контента до отслеживания прогресса — ADAPT предоставляет все инструменты 
                для создания и проведения результативных программ обучения.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-lg border bg-muted/50 p-4">
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <GraduationCap className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Интерактивное демо</p>
                    <p className="text-sm text-muted-foreground">
                      Нажмите, чтобы изучить платформу
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href="/curator/courses">Попробовать</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust logos */}
      <section className="border-t bg-muted/30 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Нам доверяют ведущие компании
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {logos.map((logo) => (
              <div
                key={logo}
                className="text-lg font-semibold text-muted-foreground/50"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Готовы трансформировать обучение?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Присоединяйтесь к тысячам компаний, которые используют ADAPT для оптимизации онбординга и обучения.
          </p>
          <Button size="lg" asChild>
            <Link href="/auth">
              Начать бесплатно
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">ADAPT</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 ADAPT. AI-платформа корпоративного обучения.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:underline">Конфиденциальность</Link>
            <Link href="#" className="hover:underline">Условия</Link>
            <Link href="#" className="hover:underline">Контакты</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
