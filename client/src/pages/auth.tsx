import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

const registerSchema = insertUserSchema.extend({
  email: z.string().email(),
});

type AuthMode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const { login, isPending: isLoginPending } = useLogin();
  const { register: registerUser, isPending: isRegisterPending } = useRegister();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const defaultRole = (params.get("role") as "curator" | "employee") || "employee";

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    }
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
      name: "",
      email: "",
      password: "",
    },
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login(data);
      toast({ title: "Добро пожаловать!", description: "Вы успешно вошли" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message || "Не удалось войти" });
    }
  };

  const onRegister = (data: z.infer<typeof registerSchema>) => {
    registerUser(data, {
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Ошибка", description: error.message || "Не удалось зарегистрироваться" });
      },
      onSuccess: () => {
        toast({ title: "Добро пожаловать!", description: "Аккаунт успешно создан" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          <Link href="/">
            <div className="flex items-center gap-3 font-display text-2xl font-bold cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
                <span className="text-lg font-black">A</span>
              </div>
              <span>ADAPT</span>
            </div>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
              Обучение через практику
            </h2>
            <p className="text-lg opacity-80 leading-relaxed">
              Короткие уроки, тесты и ролевые сценарии для эффективного обучения сотрудников
            </p>
          </div>

          <p className="text-sm opacity-60">
            © 2026 ADAPT
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 lg:hidden">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-display font-bold" data-testid="text-auth-title">
                {mode === "login" ? "Вход в систему" : "Регистрация"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {mode === "login" 
                  ? "Введите данные для входа" 
                  : "Создайте бесплатный аккаунт"}
              </p>
            </div>

            <div className="flex p-1 bg-secondary rounded-2xl">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all ${
                  mode === "login" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-login"
              >
                Вход
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all ${
                  mode === "register" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-register"
              >
                Регистрация
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={loginForm.handleSubmit(onLogin)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Email</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...loginForm.register("username")} 
                      className="h-12"
                      data-testid="input-login-email"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Введите пароль" 
                      {...loginForm.register("password")} 
                      className="h-12"
                      data-testid="input-login-password"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-12 text-base" disabled={isLoginPending} data-testid="button-login-submit">
                    {isLoginPending ? <Loader2 className="animate-spin" /> : "Войти"}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={registerForm.handleSubmit(onRegister)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Имя</Label>
                    <Input 
                      id="reg-name" 
                      placeholder="Иван Иванов" 
                      {...registerForm.register("name")} 
                      className="h-12"
                      data-testid="input-register-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...registerForm.register("email")} 
                      className="h-12"
                      data-testid="input-register-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">Пароль</Label>
                    <Input 
                      id="reg-pass" 
                      type="password" 
                      placeholder="Создайте пароль" 
                      {...registerForm.register("password")} 
                      className="h-12"
                      data-testid="input-register-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Я...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`
                        flex items-center justify-center px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
                        ${registerForm.watch("role") === "employee" 
                          ? "border-primary bg-primary/5 text-primary font-semibold" 
                          : "border-input hover:border-primary/30"}
                      `}>
                        <input 
                          type="radio" 
                          value="employee" 
                          className="hidden" 
                          {...registerForm.register("role")} 
                        />
                        Сотрудник
                      </label>
                      <label className={`
                        flex items-center justify-center px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
                        ${registerForm.watch("role") === "curator" 
                          ? "border-primary bg-primary/5 text-primary font-semibold" 
                          : "border-input hover:border-primary/30"}
                      `}>
                        <input 
                          type="radio" 
                          value="curator" 
                          className="hidden" 
                          {...registerForm.register("role")} 
                        />
                        Куратор
                      </label>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 text-base" disabled={isRegisterPending} data-testid="button-register-submit">
                    {isRegisterPending ? <Loader2 className="animate-spin" /> : "Создать аккаунт"}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
