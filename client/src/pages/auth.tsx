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
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Lime */}
      <div className="hidden lg:flex lg:w-1/2 bg-lime relative overflow-hidden">
        {/* Decorative blurred circles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-foreground/5 rounded-full blur-3xl" />
          <div className="absolute top-2/3 left-1/3 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-10 text-foreground w-full">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center backdrop-blur">
                <span className="text-lg font-bold">A</span>
              </div>
              <span className="text-xl font-bold">ADAPT</span>
            </div>
          </Link>

          {/* Headline */}
          <div className="max-w-md">
            <h2 className="text-4xl lg:text-5xl font-bold mb-5 leading-tight tracking-tight">
              Обучение через практику
            </h2>
            <p className="text-lg text-foreground/70 leading-relaxed">
              Короткие уроки, тесты и ролевые сценарии для эффективного обучения сотрудников
            </p>
          </div>

          <p className="text-sm text-foreground/50">
            © 2026 ADAPT
          </p>
        </div>
      </div>

      {/* Right Panel - White with Form */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile back button */}
        <div className="p-5 lg:hidden">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-7">
            {/* Header */}
            <div className="text-center lg:text-left">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-auth-title">
                {mode === "login" ? "Вход в систему" : "Регистрация"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {mode === "login" 
                  ? "Введите данные для входа" 
                  : "Создайте бесплатный аккаунт"}
              </p>
            </div>

            {/* Tab Toggle */}
            <div className="flex p-1 bg-surface-2 rounded-xl">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
                  mode === "login" 
                    ? "bg-lime text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-login"
              >
                Вход
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all ${
                  mode === "register" 
                    ? "bg-lime text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-register"
              >
                Регистрация
              </button>
            </div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={loginForm.handleSubmit(onLogin)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-foreground text-sm font-medium">Email</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...loginForm.register("username")} 
                      className="h-12 bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-lime focus:ring-lime/25 rounded-xl"
                      data-testid="input-login-email"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground text-sm font-medium">Пароль</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Введите пароль" 
                        {...loginForm.register("password")} 
                        className="h-12 bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-lime focus:ring-lime/25 rounded-xl pr-11"
                        data-testid="input-login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base bg-lime hover:bg-lime-hover text-foreground font-semibold rounded-xl transition-all" 
                    disabled={isLoginPending} 
                    data-testid="button-login-submit"
                  >
                    {isLoginPending ? <Loader2 className="animate-spin" /> : "Войти"}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={registerForm.handleSubmit(onRegister)}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-foreground text-sm font-medium">Имя</Label>
                    <Input 
                      id="reg-name" 
                      placeholder="Иван Иванов" 
                      {...registerForm.register("name")} 
                      className="h-12 bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-lime focus:ring-lime/25 rounded-xl"
                      data-testid="input-register-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-foreground text-sm font-medium">Email</Label>
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...registerForm.register("email")} 
                      className="h-12 bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-lime focus:ring-lime/25 rounded-xl"
                      data-testid="input-register-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass" className="text-foreground text-sm font-medium">Пароль</Label>
                    <div className="relative">
                      <Input 
                        id="reg-pass" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Создайте пароль" 
                        {...registerForm.register("password")} 
                        className="h-12 bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-lime focus:ring-lime/25 rounded-xl pr-11"
                        data-testid="input-register-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm font-medium">Я...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`
                        flex items-center justify-center px-4 py-3.5 border-2 rounded-xl cursor-pointer transition-all font-medium
                        ${registerForm.watch("role") === "employee" 
                          ? "border-lime bg-lime-soft text-foreground" 
                          : "border-border text-muted-foreground hover:border-lime/50"}
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
                        flex items-center justify-center px-4 py-3.5 border-2 rounded-xl cursor-pointer transition-all font-medium
                        ${registerForm.watch("role") === "curator" 
                          ? "border-lime bg-lime-soft text-foreground" 
                          : "border-border text-muted-foreground hover:border-lime/50"}
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
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base bg-lime hover:bg-lime-hover text-foreground font-semibold rounded-xl transition-all" 
                    disabled={isRegisterPending} 
                    data-testid="button-register-submit"
                  >
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
