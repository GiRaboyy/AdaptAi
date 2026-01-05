import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Send } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#0A1F12]">
      <div className="bg-[#A6E85B] text-[#0A1F12] text-center py-2 text-sm font-medium">
        <Sparkles className="w-4 h-4 inline mr-2" />
        Мы запустились! Попробуйте бесплатно
        <ArrowRight className="w-4 h-4 inline ml-1" />
      </div>
      
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-[#0A1F12]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight">ADAPT</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <Button 
                variant="ghost" 
                className="text-[#0A1F12] hover:bg-[#0A1F12]/5"
                data-testid="button-login"
              >
                Войти
              </Button>
            </Link>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#A6E85B] hover:bg-[#95D14A] text-[#0A1F12] border-0 h-11 px-6 rounded-[14px] font-semibold"
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
        <section className="py-20 md:py-28 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] mb-6">
                Платформа<br />
                для обучения,<br />
                <span className="text-[#A6E85B]">которую<br />полюбят.</span>
              </h1>
              <p className="text-lg text-[#0A1F12]/70 mb-8 max-w-md">
                ADAPT — современный способ обучать команду.
                Загрузите материалы, AI создаст интерактивный тренинг.
              </p>
              <Link href="/auth?role=curator">
                <Button 
                  className="bg-[#A6E85B] hover:bg-[#95D14A] text-[#0A1F12] border-0 h-14 px-8 rounded-[16px] text-lg font-semibold"
                  data-testid="button-cta-main"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Запросить демо
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-[#0A1F12]/10 p-6 max-w-md ml-auto">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-sm text-[#0A1F12]/50">ADAPT Platform</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#A6E85B]/10">
                    <div className="w-8 h-8 rounded-lg bg-[#A6E85B] flex items-center justify-center text-[#0A1F12] font-bold">
                      1
                    </div>
                    <div className="flex-1 h-2 bg-[#0A1F12]/10 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#A6E85B]/10">
                    <div className="w-8 h-8 rounded-lg bg-white border-2 border-[#A6E85B] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#A6E85B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 h-2 bg-[#0A1F12]/10 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0A1F12]/5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#0A1F12]/20 flex items-center justify-center text-[#0A1F12]/50 font-bold">
                      3
                    </div>
                    <div className="flex-1 h-2 bg-[#0A1F12]/10 rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-12 px-6 border-t border-[#0A1F12]/10 bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <span className="text-[#0A1F12]/40 font-medium">Яндекс</span>
            <span className="text-[#0A1F12]/40 font-medium">Сбер</span>
            <span className="text-[#0A1F12]/40 font-medium">Тинькофф</span>
            <span className="text-[#0A1F12]/40 font-medium">VK</span>
            <span className="text-[#0A1F12]/40 font-medium">Авито</span>
            <span className="text-[#0A1F12]/40 font-medium">Ozon</span>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#A6E85B] hover:bg-[#95D14A] text-[#0A1F12] border-0 rounded-[16px] font-extrabold px-[50px] py-[40px] text-[26px]"
                data-testid="button-cta-companies"
              >
                Получить доступ
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Как это работает</h2>
              <p className="text-[#0A1F12]/60 max-w-xl mx-auto text-lg">
                Три простых шага для запуска обучения
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 rounded-2xl bg-[#FAFAFA] border border-[#0A1F12]/5">
                <div className="w-16 h-16 rounded-2xl bg-[#A6E85B]/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-[#A6E85B]">1</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Загрузите материалы</h3>
                <p className="text-[#0A1F12]/60">
                  Вставьте текст или загрузите документы с базой знаний
                </p>
              </div>

              <div className="text-center p-8 rounded-2xl bg-[#FAFAFA] border border-[#0A1F12]/5">
                <div className="w-16 h-16 rounded-2xl bg-[#A6E85B]/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-[#A6E85B]">2</span>
                </div>
                <h3 className="text-xl font-bold mb-3">AI создаст курс</h3>
                <p className="text-[#0A1F12]/60">
                  Уроки, тесты и ролевые сценарии сгенерируются автоматически
                </p>
              </div>

              <div className="text-center p-8 rounded-2xl bg-[#FAFAFA] border border-[#0A1F12]/5">
                <div className="w-16 h-16 rounded-2xl bg-[#A6E85B]/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-[#A6E85B]">3</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Пригласите команду</h3>
                <p className="text-[#0A1F12]/60">
                  Поделитесь кодом и отслеживайте прогресс в реальном времени
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-[#A6E85B]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#0A1F12]">
              Готовы начать обучение?
            </h2>
            <p className="text-xl text-[#0A1F12]/70 mb-10 max-w-xl mx-auto">
              Создайте первый курс бесплатно и оцените возможности платформы
            </p>
            <Link href="/auth?role=curator">
              <Button 
                className="bg-[#0A1F12] hover:bg-[#0A1F12]/90 text-white border-0 h-16 px-10 rounded-[18px] text-xl font-semibold"
                data-testid="button-cta-final"
              >
                Создать курс бесплатно
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-6 border-t border-[#0A1F12]/10 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-lg">ADAPT</span>
          <p className="text-sm text-[#0A1F12]/50">
            © 2026 ADAPT. Платформа адаптивного обучения.
          </p>
        </div>
      </footer>
    </div>
  );
}
