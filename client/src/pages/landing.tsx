import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BookOpen, Users, CheckCircle, BarChart3, Play, Volume2 } from "lucide-react";
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
      <header className="sticky top-0 z-50 bg-white border-b border-[#0a1f12]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold tracking-tight text-[30px]">ADAPT</span>
          <div className="flex items-center gap-4">
            <Link href="/auth">
              <span className="text-[#0a1f12]/70 hover:text-[#0a1f12] font-medium cursor-pointer" data-testid="button-login">
                Войти
              </span>
            </Link>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#A6E85B] hover:bg-[#9AD94F] text-[#0a1f12] border-0 h-11 px-6 rounded-full font-semibold text-sm"
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
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-[52px] md:text-[64px] lg:text-[72px] font-bold leading-[1.05] mb-8 tracking-tight">
                Платформа<br />
                для обучения,<br />
                <span className="text-[#A6E85B]">которую<br />полюбят.</span>
              </h1>
              <p className="text-lg text-[#0a1f12]/60 mb-10 max-w-md leading-relaxed">
                ADAPT — современный способ обучать команду.
                Загрузите материалы, AI создаст интерактивный тренинг.
              </p>
              <Link href="/auth?role=curator">
                <Button 
                  className="bg-[#A6E85B] hover:bg-[#9AD94F] text-[#0a1f12] border-0 rounded-2xl font-bold text-[25px] px-[50px] py-[40px]"
                  data-testid="button-cta-main"
                >
                  <Sparkles className="w-6 h-6 mr-3" />
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
              <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[#0a1f12]/10 overflow-hidden max-w-md ml-auto">
                <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFAFA] border-b border-[#0a1f12]/10">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-sm text-[#0a1f12]/40 font-medium">ADAPT Platform</span>
                </div>
                
                <div className="flex">
                  <div className="w-48 bg-white border-r border-[#0a1f12]/10 p-3">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-[#A6E85B] flex items-center justify-center">
                        <span className="text-[#0a1f12] text-sm font-bold">A</span>
                      </div>
                      <span className="font-bold text-sm">ADAPT</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#A6E85B]/15">
                        <BookOpen className="w-4 h-4 text-[#3D7A1E]" />
                        <span className="text-xs font-medium">Мои курсы</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg text-[#0a1f12]/50">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-xs">Аналитика</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg text-[#0a1f12]/50">
                        <Users className="w-4 h-4" />
                        <span className="text-xs">Профиль</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4 bg-[#F8FAFC]">
                    <div className="mb-4">
                      <h3 className="font-bold text-sm mb-1">Продуктовые продажи</h3>
                      <div className="flex items-center gap-2 text-xs text-[#0a1f12]/50">
                        <span>Шаг 2 из 8</span>
                        <Progress value={25} className="h-1.5 flex-1" />
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-[#0a1f12]/10 p-4 mb-3">
                      <p className="text-xs text-[#0a1f12]/80 leading-relaxed mb-3">
                        Клиент говорит: "Мне нужно подумать". Какой ваш следующий шаг?
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded-lg border border-[#A6E85B] bg-[#A6E85B]/10 text-xs">
                          <CheckCircle className="w-3 h-3 text-[#3D7A1E]" />
                          <span>Уточнить сомнения</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg border border-[#0a1f12]/10 text-xs text-[#0a1f12]/60">
                          <div className="w-3 h-3 rounded-full border border-[#0a1f12]/20" />
                          <span>Предложить скидку</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button className="w-8 h-8 rounded-lg bg-white border border-[#0a1f12]/10 flex items-center justify-center">
                          <Volume2 className="w-4 h-4 text-[#0a1f12]/50" />
                        </button>
                      </div>
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#A6E85B] text-xs font-medium">
                        <span>Далее</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-10 px-6 border-y border-[#0a1f12]/10 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mb-8">
              {trustedCompanies.map((company) => (
                <span key={company} className="text-[#0a1f12]/30 font-semibold text-lg">{company}</span>
              ))}
            </div>
            <Link href="/auth?role=curator" className="block">
              <button 
                className="w-full bg-[#A6E85B] hover:bg-[#9AD94F] hover:shadow-lg transition-all duration-200 text-[#0a1f12] border-0 py-8 rounded-2xl text-2xl font-bold flex items-center justify-center gap-4"
                data-testid="button-cta-companies"
              >
                Получить доступ
                <ArrowRight className="w-7 h-7" />
              </button>
            </Link>
          </div>
        </section>

        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-tight">Как это работает</h2>
              <p className="text-[#0a1f12]/50 max-w-lg mx-auto text-lg">
                Три простых шага для запуска обучения
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { num: '1', title: 'Загрузите материалы', desc: 'Вставьте текст или загрузите документы с базой знаний' },
                { num: '2', title: 'AI создаст курс', desc: 'Уроки, тесты и ролевые сценарии сгенерируются автоматически' },
                { num: '3', title: 'Пригласите команду', desc: 'Поделитесь кодом и отслеживайте прогресс в реальном времени' },
              ].map((step) => (
                <div key={step.num} className="text-center p-8 rounded-3xl bg-[#FAFAFA] border border-[#0a1f12]/5">
                  <div className="w-16 h-16 rounded-2xl bg-[#A6E85B]/20 flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-[#A6E85B]">{step.num}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-[#0a1f12]/50 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-[#A6E85B]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#0a1f12] tracking-tight">
              Готовы начать обучение?
            </h2>
            <p className="text-xl text-[#0a1f12]/60 mb-12 max-w-lg mx-auto">
              Создайте первый курс бесплатно и оцените возможности платформы
            </p>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#0a1f12] hover:bg-[#0a1f12]/90 text-white border-0 h-[72px] px-14 rounded-2xl text-xl font-bold"
                data-testid="button-cta-final"
              >
                Создать курс бесплатно
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <footer className="py-8 px-6 border-t border-[#0a1f12]/10 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-lg">ADAPT</span>
          <p className="text-sm text-[#0a1f12]/40">
            © 2026 ADAPT. Платформа адаптивного обучения.
          </p>
        </div>
      </footer>
    </div>
  );
}
