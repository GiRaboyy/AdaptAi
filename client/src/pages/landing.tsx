import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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
                  className="bg-[#A6E85B] hover:bg-[#9AD94F] text-[#0a1f12] border-0 h-16 px-10 rounded-2xl text-lg font-bold pl-[60px] pr-[60px] pt-[40px] pb-[40px]"
                  data-testid="button-cta-main"
                >
                  <Sparkles className="w-5 h-5 mr-3" />
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
              <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[#0a1f12]/10 p-6 max-w-sm ml-auto">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-sm text-[#0a1f12]/40 font-medium">ADAPT Platform</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#A6E85B]/10">
                    <div className="w-10 h-10 rounded-xl bg-[#A6E85B] flex items-center justify-center text-[#0a1f12] font-bold text-lg">
                      1
                    </div>
                    <div className="flex-1 h-3 bg-[#0a1f12]/10 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#A6E85B]/10">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#A6E85B] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#A6E85B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 h-3 bg-[#0a1f12]/10 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0a1f12]/[0.04]">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#0a1f12]/15 flex items-center justify-center text-[#0a1f12]/40 font-bold text-lg">
                      3
                    </div>
                    <div className="flex-1 h-3 bg-[#0a1f12]/10 rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-6 px-6 border-y border-[#0a1f12]/10 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {trustedCompanies.map((company) => (
              <span key={company} className="text-[#0a1f12]/30 font-semibold text-lg">{company}</span>
            ))}
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#A6E85B] hover:bg-[#9AD94F] text-[#0a1f12] border-0 h-16 px-12 rounded-2xl text-xl font-bold"
                data-testid="button-cta-companies"
              >
                Получить доступ
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
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
