import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BookOpen, Users, CheckCircle, BarChart3, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const trustedCompanies = ['Яндекс', 'Сбер', 'Тинькофф', 'VK', 'Авито', 'Ozon'];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#0a1f12]">
      <div className="bg-[#A6E85B] text-[#0a1f12] text-center py-3 text-sm font-medium">
        <Sparkles className="w-4 h-4 inline mr-2" />
        Мы запустились! Попробуйте бесплатно
        <ArrowRight className="w-4 h-4 inline ml-1" />
      </div>
      <header className="sticky top-0 z-50 bg-white border-b border-[#0a1f12]/20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold tracking-tight text-[30px] text-[#0a1f12]">ADAPT</span>
          <div className="flex items-center gap-4">
            <Link href="/auth">
              <span className="text-[#0a1f12] hover:text-[#A6E85B] font-semibold cursor-pointer" data-testid="button-login">
                Войти
              </span>
            </Link>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#A6E85B] text-[#0a1f12] border border-[#0a1f12]/30 h-12 px-8 rounded-full font-bold text-base"
                data-testid="button-start"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Получить доступ
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-[52px] md:text-[64px] lg:text-[72px] font-bold leading-[1.05] mb-8 tracking-tight text-[#0a1f12]">
                Платформа<br />
                для обучения,<br />
                <span className="text-[#A6E85B]">которую<br />полюбят.</span>
              </h1>
              <p className="text-xl text-[#0a1f12]/70 mb-10 max-w-md leading-relaxed font-medium">
                ADAPT — современный способ обучать команду.
                Загрузите материалы, AI создаст интерактивный тренинг.
              </p>
              <Link href="/auth?role=curator">
                <Button 
                  className="bg-[#A6E85B] text-[#0a1f12] border border-[#0a1f12]/30 rounded-2xl font-bold text-[28px] px-[60px] py-[48px]"
                  data-testid="button-cta-main"
                >
                  <Sparkles className="w-7 h-7 mr-4" />
                  Запросить демо
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden md:block"
            >
              <div className="bg-white rounded-3xl shadow-lg border border-[#0a1f12]/20 overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 bg-[#FAFAFA] border-b border-[#0a1f12]/20">
                  <div className="w-4 h-4 rounded-full bg-[#FF5F56]" />
                  <div className="w-4 h-4 rounded-full bg-[#FFBD2E]" />
                  <div className="w-4 h-4 rounded-full bg-[#27C93F]" />
                  <span className="ml-6 text-base font-semibold text-[#0a1f12]">ADAPT Platform</span>
                </div>
                
                <div className="flex">
                  <div className="w-64 bg-white border-r border-[#0a1f12]/20 p-5">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-[#A6E85B] border border-[#0a1f12]/30 flex items-center justify-center">
                        <span className="text-[#0a1f12] text-lg font-bold">A</span>
                      </div>
                      <span className="font-bold text-lg text-[#0a1f12]">ADAPT</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#A6E85B]/20 border border-[#A6E85B]">
                        <BookOpen className="w-5 h-5 text-[#0a1f12]" />
                        <span className="text-sm font-bold text-[#0a1f12]">Мои курсы</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl text-[#0a1f12]/60 border border-transparent">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-sm font-medium">Аналитика</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl text-[#0a1f12]/60 border border-transparent">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-medium">Профиль</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 bg-[#FAFAFA]">
                    <div className="mb-6">
                      <h3 className="font-bold text-lg mb-2">Продуктовые продажи</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                        <span>Шаг 2 из 8</span>
                        <Progress value={25} className="h-2 flex-1" />
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl border border-[#0a1f12]/20 p-5 mb-4">
                      <p className="text-sm leading-relaxed mb-4 font-medium text-[#0a1f12]">
                        Клиент говорит: "Мне нужно подумать". Какой ваш следующий шаг?
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#A6E85B] bg-[#A6E85B]/15 text-sm">
                          <CheckCircle className="w-5 h-5 text-[#A6E85B]" />
                          <span className="font-bold text-[#0a1f12]">Уточнить сомнения</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#0a1f12]/20 text-sm text-[#0a1f12]/60">
                          <div className="w-5 h-5 rounded-full border border-[#0a1f12]/30" />
                          <span className="font-medium">Предложить скидку</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button className="w-10 h-10 rounded-xl bg-white border border-[#0a1f12]/20 flex items-center justify-center text-[#0a1f12]">
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>
                      <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A6E85B] text-sm font-bold text-[#0a1f12] border border-[#0a1f12]/30">
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

        <section className="py-6 px-6 border-y border-[#0a1f12]/20 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {trustedCompanies.map((company) => (
              <span key={company} className="text-[#0a1f12]/50 font-bold text-lg">{company}</span>
            ))}
            <Link href="/auth?role=curator">
              <button 
                className="bg-[#A6E85B] hover-elevate transition-all duration-200 text-[#0a1f12] border border-[#0a1f12]/30 py-5 px-12 rounded-xl text-xl font-bold flex items-center gap-3"
                data-testid="button-cta-companies"
              >
                Получить доступ
                <ArrowRight className="w-6 h-6" />
              </button>
            </Link>
          </div>
        </section>

        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-tight text-[#0a1f12]">Как это работает</h2>
              <p className="text-[#0a1f12]/70 max-w-lg mx-auto text-xl font-medium">
                Три простых шага для запуска обучения
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { num: '1', title: 'Загрузите материалы', desc: 'Вставьте текст или загрузите документы с базой знаний' },
                { num: '2', title: 'AI создаст курс', desc: 'Уроки, тесты и ролевые сценарии сгенерируются автоматически' },
                { num: '3', title: 'Пригласите команду', desc: 'Поделитесь кодом и отслеживайте прогресс в реальном времени' },
              ].map((step) => (
                <div key={step.num} className="text-center p-8 rounded-3xl bg-white border border-[#A6E85B]">
                  <div className="w-16 h-16 rounded-2xl bg-[#A6E85B] border border-[#0a1f12]/30 flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-[#0a1f12]">{step.num}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-[#0a1f12]">{step.title}</h3>
                  <p className="text-[#0a1f12]/70 leading-relaxed font-medium">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-[#A6E85B]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-black tracking-tight">
              Готовы начать обучение?
            </h2>
            <p className="text-xl text-black/80 mb-12 max-w-lg mx-auto font-medium">
              Создайте первый курс бесплатно и оцените возможности платформы
            </p>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-black hover:bg-black/90 text-white border border-black h-[80px] px-16 rounded-2xl text-2xl font-bold"
                data-testid="button-cta-final"
              >
                Создать курс бесплатно
                <ArrowRight className="w-7 h-7 ml-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <footer className="py-8 px-6 border-t border-[#0a1f12]/20 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-lg text-[#0a1f12]">ADAPT</span>
          <p className="text-sm text-[#0a1f12]/60 font-medium">
            © 2026 ADAPT. Платформа адаптивного обучения.
          </p>
        </div>
      </footer>
    </div>
  );
}
