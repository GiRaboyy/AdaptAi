import { useState, useEffect } from "react";
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
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

const registerSchema = insertUserSchema.extend({
  email: z.string().email(),
});

type AuthMode = "login" | "register" | "verify-email";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const { login, isPending: isLoginPending } = useLogin();
  const { register: registerUser, isPending: isRegisterPending, isSuccess: isRegisterSuccess, data: registerData, reset: resetRegister } = useRegister();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const defaultRole = (params.get("role") as "curator" | "employee") || "employee";
  const verified = params.get("verified");

  // Show success message if email was verified
  useEffect(() => {
    if (verified === "true") {
      toast({ title: "Email подтверждён!", description: "Теперь вы можете войти" });
      // Clean URL
      window.history.replaceState({}, '', '/auth');
    }
  }, [verified, toast]);

  // Switch to verification screen when registration succeeds
  useEffect(() => {
    if (isRegisterSuccess && registerData?.needsVerification) {
      setPendingEmail(registerData.user?.email || "");
      setMode("verify-email");
    }
  }, [isRegisterSuccess, registerData]);

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
      // Success redirect is handled in useLogin hook
    } catch (error: any) {
      toast({ variant: "destructive", title: "Ошибка", description: error.message || "Не удалось войти" });
    }
  };

  const onRegister = (data: z.infer<typeof registerSchema>) => {
    registerUser(data, {
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Ошибка", description: error.message || "Не удалось зарегистрироваться" });
      },
    });
  };

  const handleBackFromVerify = () => {
    resetRegister();
    setMode("register");
    setPendingEmail("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          <Link href="/">
            <div className="flex items-center gap-3 text-2xl font-bold cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center backdrop-blur">
                <span className="text-lg font-black">A</span>
              </div>
              <span>ADAPT</span>
            </div>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Обучение через практику
            </h2>
            <p className="text-lg text-primary-foreground/70 leading-relaxed">
              Короткие уроки, тесты и ролевые сценарии для эффективного обучения сотрудников
            </p>
          </div>

          <p className="text-sm text-primary-foreground/60">
            © 2026 ADAPT
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-background">
        <div className="p-6 lg:hidden">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-auth-title">
                {mode === "login" ? "Вход в систему" : "Регистрация"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {mode === "login" 
                  ? "Введите данные для входа" 
                  : "Создайте бесплатный аккаунт"}
              </p>
            </div>

            <div className="flex p-1 bg-muted rounded-2xl">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${
                  mode === "login" 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-login"
              >
                Вход
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all ${
                  mode === "register" 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-tab-register"
              >
                Регистрация
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "verify-email" ? (
                <motion.div
                  key="verify-email"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 text-center"
                >
                  <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      Подтвердите email
                    </h2>
                    <p className="text-muted-foreground">
                      Мы отправили письмо с подтверждением на:
                    </p>
                    <p className="text-lg font-medium text-foreground">
                      {pendingEmail}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-xl text-sm text-muted-foreground">
                    Перейдите по ссылке в письме, чтобы завершить регистрацию
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={handleBackFromVerify}
                    className="w-full h-12"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Назад
                  </Button>
                </motion.div>
              ) : mode === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-5"
                >
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-foreground">Email</Label>
                    <Input 
                      id="username" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...loginForm.register("username")} 
                      className="h-12 bg-background"
                      data-testid="input-login-email"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Пароль</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Введите пароль" 
                      {...loginForm.register("password")} 
                      className="h-12 bg-background"
                      data-testid="input-login-password"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold rounded-xl" 
                    disabled={isLoginPending} 
                    data-testid="button-login-submit"
                  >
                    {isLoginPending ? <Loader2 className="animate-spin" /> : "Войти"}
                  </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-foreground">Имя</Label>
                    <Input 
                      id="reg-name" 
                      placeholder="Иван Иванов" 
                      {...registerForm.register("name")} 
                      className="h-12 bg-background"
                      data-testid="input-register-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-foreground">Email</Label>
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="name@example.com" 
                      {...registerForm.register("email")} 
                      className="h-12 bg-background"
                      data-testid="input-register-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass" className="text-foreground">Пароль</Label>
                    <Input 
                      id="reg-pass" 
                      type="password" 
                      placeholder="Создайте пароль" 
                      {...registerForm.register("password")} 
                      className="h-12 bg-background"
                      data-testid="input-register-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Я...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`
                        flex items-center justify-center px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
                        ${registerForm.watch("role") === "employee" 
                          ? "border-primary bg-primary/10 text-foreground font-semibold" 
                          : "border-border text-muted-foreground hover:border-primary/50"}
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
                          ? "border-primary bg-primary/10 text-foreground font-semibold" 
                          : "border-border text-muted-foreground hover:border-primary/50"}
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
                    className="w-full h-12 text-base font-semibold rounded-xl" 
                    disabled={isRegisterPending} 
                    data-testid="button-register-submit"
                  >
                    {isRegisterPending ? <Loader2 className="animate-spin" /> : "Создать аккаунт"}
                  </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
