import { useState } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isLogin = mode === "login";

  const handleSubmit = async () => {
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Preencha email e senha.");
      return;
    }

    try {
      setLoading(true);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("Entrando...");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Conta criada e login realizado.");
        } else {
          setMessage("Conta criada. Agora volte e faça login.");
        }
      }
    } catch (error: any) {
      setMessage(error?.message || "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Header title="Entrar" />

      <div className="flex-1 overflow-y-auto p-6 pb-12">
        <div className="mx-auto max-w-md space-y-8">
          <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                Acesso
              </p>
              <h1 className="font-serif text-3xl text-foreground">
                {isLogin ? "Entrar no app" : "Criar conta"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Use o mesmo email em qualquer dispositivo para ver os mesmos
                dados.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="auth-email"
                  className="text-xs font-medium uppercase tracking-widest text-primary/60"
                >
                  Email
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-11 rounded-xl border-border/50 bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="auth-password"
                  className="text-xs font-medium uppercase tracking-widest text-primary/60"
                >
                  Senha
                </Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="h-11 rounded-xl border-border/50 bg-background"
                />
              </div>

              {message && (
                <div className="rounded-xl border border-border/50 bg-background px-3 py-3 text-sm text-muted-foreground">
                  {message}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </button>
            </div>

            <div className="mt-5 border-t border-border/50 pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(isLogin ? "signup" : "login");
                  setMessage("");
                }}
                className="text-sm text-primary"
              >
                {isLogin
                  ? "Ainda não tenho conta"
                  : "Já tenho conta, quero entrar"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
