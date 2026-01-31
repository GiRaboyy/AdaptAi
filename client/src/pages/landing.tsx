import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BookOpen, Users, CheckCircle, BarChart3, Volume2, Upload, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const trustedCompanies = ['Яндекс', 'Сбер', 'Тинькофф', 'VK', 'Авито', 'Ozon'];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Announcement Banner */}
      <div className="bg-lime text-foreground text-center py-3 px-4 text-sm font-medium">
        <Sparkles className="w-4 h-4 inline mr-2" />
        Мы запустились! Попробуйте бесплатно
        <ArrowRight className="w-4 h-4 inline ml-1" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-lime flex items-center justify-center">
              <span className="text-foreground text-lg font-bold">A</span>
            </div>
            <span className="font-bold tracking-tight text-xl text-foreground">ADAPT</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth">
              <span className="text-foreground hover:text-foreground/80 font-medium cursor-pointer transition-colors" data-testid="button-login">
                Войти
              </span>
            </Link>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-lime hover:bg-lime-hover text-foreground h-11 px-6 rounded-full font-semibold text-sm transition-all"
                data-testid="button-start"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Получить доступ
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 md:py-28 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-[44px] md:text-[56px] lg:text-[64px] font-bold leading-[1.08] mb-6 tracking-tight text-foreground text-balance">
                Платформа для обучения,{" "}
                <span className="text-lime-hover">которую полюбят.</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                ADAPT — современный способ обучать команду. Загрузите материалы, AI создаст интерактивный тренинг.
              </p>
              <Link href="/auth?role=curator">
                <Button 
                  className="bg-lime hover:bg-lime-hover text-foreground rounded-2xl font-bold text-xl px-10 py-7 h-auto transition-all hover-elevate"
                  data-testid="button-cta-main"
                >
                  <Sparkles className="w-6 h-6 mr-3" />
                  Запросить демо
                </Button>
              </Link>
            </motion.div>

            {/* Platform Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="relative hidden md:block"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-border overflow-hidden">
                {/* Window Controls */}
                <div className="flex items-center gap-2 px-5 py-3 bg-surface-2 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-sm font-medium text-muted-foreground">ADAPT Platform</span>
                </div>
                
                <div className="flex">
                  {/* Sidebar Preview */}
                  <div className="w-56 bg-navy p-4">
                    <div className="flex items-center gap-2.5 mb-6">
                      <div className="w-9 h-9 rounded-lg bg-lime flex items-center justify-center">
                        <span className="text-foreground text-sm font-bold">A</span>
                      </div>
                      <span className="font-bold text-white">ADAPT</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-lime/20 border border-lime/30">
                        <BookOpen className="w-4 h-4 text-lime" />
                        <span className="text-sm font-semibold text-white">Мои курсы</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/60">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm">Аналитика</span>
                      </div>
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/60">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Профиль</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content Preview */}
                  <div className="flex-1 p-5 bg-surface-2">
                    <div className="mb-5">
                      <h3 className="font-bold text-base mb-1.5">Продуктовые продажи</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Шаг 2 из 8</span>
                        <Progress value={25} className="h-2 flex-1 max-w-32" />
                      </div>
                    </div>
                    
                    {/* Quiz Card */}
                    <div className="bg-white rounded-xl border border-border p-4 mb-3">
                      <p className="text-sm leading-relaxed mb-3 text-foreground">
                        Клиент говорит: "Мне нужно подумать". Какой ваш следующий шаг?
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-lime bg-lime-soft text-sm">
                          <CheckCircle className="w-4 h-4 text-lime-hover" />
                          <span className="font-semibold text-foreground">Уточнить сомнения</span>
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
                          <div className="w-4 h-4 rounded-full border-2 border-border" />
                          <span>Предложить скидку</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <button className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center text-muted-foreground">
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime text-sm font-semibold text-foreground">
                        <span>Далее</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="py-5 px-6 border-y border-border bg-surface-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {trustedCompanies.map((company) => (
              <span key={company} className="text-muted-foreground/60 font-semibold text-base">{company}</span>
            ))}
            <Link href="/auth?role=curator">
              <button 
                className="bg-lime hover:bg-lime-hover transition-all text-foreground py-4 px-8 rounded-xl text-base font-semibold flex items-center gap-2"
                data-testid="button-cta-companies"
              >
                Получить доступ
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-foreground">Как это работает</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                Три простых шага для запуска обучения
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { 
                  num: '1', 
                  icon: Upload,
                  title: 'Загрузите материалы', 
                  desc: 'Вставьте текст или загрузите документы с базой знаний' 
                },
                { 
                  num: '2', 
                  icon: Zap,
                  title: 'AI создаст курс', 
                  desc: 'Уроки, тесты и ролевые сценарии сгенерируются автоматически' 
                },
                { 
                  num: '3', 
                  icon: Users,
                  title: 'Пригласите команду', 
                  desc: 'Поделитесь кодом и отслеживайте прогресс в реальном времени' 
                },
              ].map((step) => (
                <motion.div 
                  key={step.num} 
                  className="text-center p-7 rounded-2xl bg-white border border-border hover:border-lime transition-all hover-lift"
                  whileHover={{ y: -4 }}
                >
                  <div className="w-14 h-14 rounded-xl bg-lime flex items-center justify-center mx-auto mb-5">
                    <step.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 bg-lime">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-5 text-foreground tracking-tight">
              Готовы начать обучение?
            </h2>
            <p className="text-lg text-foreground/80 mb-10 max-w-lg mx-auto">
              Создайте первый курс бесплатно и оцените возможности платформы
            </p>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-navy hover:bg-navy-light text-white h-16 px-12 rounded-2xl text-lg font-bold transition-all"
                data-testid="button-cta-final"
              >
                Создать курс бесплатно
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-lime flex items-center justify-center">
              <span className="text-foreground text-xs font-bold">A</span>
            </div>
            <span className="font-bold text-foreground">ADAPT</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 ADAPT. Платформа адаптивного обучения.
          </p>
        </div>
      </footer>
    </div>
  );
}
