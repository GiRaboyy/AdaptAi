import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Schema for login form
const loginSchema = z.object({
  username: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Schema for registration form
const registerSchema = insertUserSchema.extend({
  email: z.string().email(),
});

type AuthMode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const { login, isPending: isLoginPending } = useLogin();
  const { mutate: register, isPending: isRegisterPending } = useRegister();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Parse URL search params for role default
  const params = new URLSearchParams(window.location.search);
  const defaultRole = (params.get("role") as "curator" | "employee") || "employee";

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
    },
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login.mutateAsync(data);
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const onRegister = (data: z.infer<typeof registerSchema>) => {
    register(data, {
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
      onSuccess: () => {
        toast({ title: "Success", description: "Account created! Please login." });
        setMode("login");
      }
    });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-overlay" />
        
        <div className="relative z-10 flex items-center gap-2 text-2xl font-display font-bold">
          <Brain className="w-8 h-8" /> Mentora
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-display font-bold mb-6">Master your craft through conversation.</h2>
          <p className="text-lg opacity-90">Join thousands of professionals using AI-driven roleplay to refine their skills before they matter.</p>
        </div>

        <div className="relative z-10 text-sm opacity-60">
          © 2025 Mentora Inc.
        </div>
      </div>

      {/* Right: Forms */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {mode === "login" 
                ? "Enter your credentials to access your workspace." 
                : "Get started with your free account."}
            </p>
          </div>

          <div className="flex p-1 bg-secondary rounded-xl mb-8">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "register" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
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
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Email</Label>
                  <Input 
                    id="username" 
                    type="email" 
                    placeholder="name@example.com" 
                    {...loginForm.register("username")} 
                    className="h-12 rounded-xl"
                  />
                  {loginForm.formState.errors.username && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    {...loginForm.register("password")} 
                    className="h-12 rounded-xl"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={isLoginPending}>
                  {isLoginPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={registerForm.handleSubmit(onRegister)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input 
                    id="reg-name" 
                    placeholder="John Doe" 
                    {...registerForm.register("name")} 
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input 
                    id="reg-email" 
                    type="email" 
                    placeholder="name@example.com" 
                    {...registerForm.register("email")} 
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-pass">Password</Label>
                  <Input 
                    id="reg-pass" 
                    type="password" 
                    placeholder="••••••••" 
                    {...registerForm.register("password")} 
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>I am a...</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`
                      flex items-center justify-center px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
                      ${registerForm.watch("role") === "employee" 
                        ? "border-primary bg-primary/5 text-primary font-bold" 
                        : "border-input hover:bg-secondary/50"}
                    `}>
                      <input 
                        type="radio" 
                        value="employee" 
                        className="hidden" 
                        {...registerForm.register("role")} 
                      />
                      Learner
                    </label>
                    <label className={`
                      flex items-center justify-center px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
                      ${registerForm.watch("role") === "curator" 
                        ? "border-primary bg-primary/5 text-primary font-bold" 
                        : "border-input hover:bg-secondary/50"}
                    `}>
                      <input 
                        type="radio" 
                        value="curator" 
                        className="hidden" 
                        {...registerForm.register("role")} 
                      />
                      Curator
                    </label>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={isRegisterPending}>
                  {isRegisterPending ? <Loader2 className="animate-spin" /> : "Create Account"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
