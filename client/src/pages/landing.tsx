import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, Sparkles, Target, Users, CheckCircle, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-black">A</span>
            </div>
            <span className="font-display font-bold text-xl">ADAPT</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <Button variant="ghost" data-testid="button-login">Войти</Button>
            </Link>
            <Link href="/auth?role=curator">
              <Button data-testid="button-start">Начать</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <section className="py-20 md:py-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                ИИ-платформа обучения
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
                Обучение сотрудников <br />
                <span className="text-primary">быстро и эффективно</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Создавайте курсы на основе ваших материалов за минуты. 
                Тесты, ролевые сценарии и аналитика в одном месте.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth?role=curator">
                  <Button size="lg" className="h-14 px-8 text-lg" data-testid="button-cta-curator">
                    Создать курс <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/auth?role=employee">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg" data-testid="button-cta-employee">
                    Присоединиться
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-6 bg-secondary/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4">Как это работает</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Три простых шага для запуска обучения
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="text-center">
                <CardContent className="pt-8 pb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">1. Загрузите материалы</h3>
                  <p className="text-muted-foreground text-sm">
                    Вставьте текст или загрузите документы с базой знаний
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-8 pb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">2. ИИ создаст курс</h3>
                  <p className="text-muted-foreground text-sm">
                    Уроки, тесты и ролевые сценарии сгенерируются автоматически
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-8 pb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">3. Пригласите команду</h3>
                  <p className="text-muted-foreground text-sm">
                    Поделитесь кодом и отслеживайте прогресс в реальном времени
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4">Возможности платформы</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Drill Mode</h3>
                  <p className="text-muted-foreground text-sm">
                    Автоматическое закрепление материала при ошибках. Система покажет правильный ответ и предложит повторить
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Реальная аналитика</h3>
                  <p className="text-muted-foreground text-sm">
                    Отслеживайте прогресс сотрудников, выявляйте проблемные темы и оптимизируйте обучение
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Ролевые сценарии</h3>
                  <p className="text-muted-foreground text-sm">
                    Практикуйте реальные рабочие ситуации с голосовым вводом и обратной связью
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 rounded-xl bg-secondary/50">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Редактор курсов</h3>
                  <p className="text-muted-foreground text-sm">
                    Редактируйте сгенерированный контент, добавляйте шаги и настраивайте под свои нужды
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
              Готовы начать обучение?
            </h2>
            <p className="text-lg opacity-80 mb-8 max-w-xl mx-auto">
              Создайте первый курс бесплатно и оцените возможности платформы
            </p>
            <Link href="/auth?role=curator">
              <Button size="lg" variant="secondary" className="h-14 px-8 text-lg" data-testid="button-cta-final">
                Создать курс бесплатно <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-6 border-t">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-black">A</span>
            </div>
            <span className="font-display font-bold">ADAPT</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 ADAPT. Платформа адаптивного обучения.
          </p>
        </div>
      </footer>
    </div>
  );
}
