import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useAppearance } from "@/hooks/use-appearance";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Sun, Flame, AlertTriangle, LogOut, User, Trash2 } from "lucide-react";

export default function Settings() {
  const { appearance, setAppearance } = useAppearance();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  const clearLocalAppData = () => {
    const keysToDelete = Object.keys(localStorage).filter(
      (k) =>
        /^\d{4}-\d{2}-\d{2}-/.test(k) ||
        k.startsWith("weekly-plan-") ||
        k.startsWith("planner-week-virtue-") ||
        k.startsWith("weekly-closing-") ||
        k === "global-habits" ||
        k === "emotion-history-v1",
    );

    keysToDelete.forEach((k) => localStorage.removeItem(k));
  };

  const handleResetApp = async () => {
    try {
      setIsResetting(true);
      setMessage("");

      clearLocalAppData();

      if (user?.id) {
        const daily = await supabase
          .from("daily_records")
          .delete()
          .eq("user_id", user.id);

        if (daily.error) throw daily.error;

        const weeklyPlans = await supabase
          .from("weekly_plans")
          .delete()
          .eq("user_id", user.id);

        if (weeklyPlans.error) throw weeklyPlans.error;

        const weeklyMeta = await supabase
          .from("weekly_meta")
          .delete()
          .eq("user_id", user.id);

        if (weeklyMeta.error) throw weeklyMeta.error;

        const habits = await supabase
          .from("user_habits")
          .delete()
          .eq("user_id", user.id);

        if (habits.error) throw habits.error;
      }

      setConfirmReset(false);
      setMessage("App zerado com sucesso para novo uso.");
      navigate("/");

      window.setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error("Erro ao zerar app:", error);
      setMessage("Nao foi possivel zerar o app agora.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setMessage("");

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      navigate("/");
      window.location.reload();
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      setMessage("Nao foi possivel sair da conta agora.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Layout>
      <Header title="Ajustes" />

      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        {message && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {message}
          </div>
        )}

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-5">
            Conta
          </h2>

          <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <User className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Conectado como
                </p>
                <p className="mt-1 text-sm text-foreground break-all">
                  {user?.email || "Nenhuma conta conectada"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border/40 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {isSigningOut ? "Saindo..." : "Sair da conta"}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-5">
            Aparencia
          </h2>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAppearance("day")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "day"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Sun
                className={cn(
                  "w-7 h-7",
                  appearance === "day" ? "stroke-[2]" : "stroke-[1.5]",
                )}
              />
              <span className="text-sm font-medium font-serif">Luz do Dia</span>
            </button>

            <button
              type="button"
              onClick={() => setAppearance("candle")}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-2xl border-2 transition-all",
                appearance === "candle"
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Flame
                className={cn(
                  "w-7 h-7",
                  appearance === "candle" ? "stroke-[2]" : "stroke-[1.5]",
                )}
              />
              <span className="text-sm font-medium font-serif">
                Luz de Velas
              </span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-3 text-center font-serif italic">
            {appearance === "day"
              ? "Clareza e leveza para o dia."
              : "Calor e foco para a noite."}
          </p>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-destructive/60 mb-5">
            Zerar app
          </h2>

          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Esta acao apaga os registros desta conta no Supabase e tambem
                limpa os dados locais deste dispositivo. A conta continua a
                mesma.
              </p>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Zerar app para novo uso
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-center text-destructive">
                  Tem certeza? Isso vai apagar os dados desta conta e deste
                  dispositivo.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    disabled={isResetting}
                    className="flex-1 py-2.5 rounded-xl border border-border/40 text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleResetApp}
                    disabled={isResetting}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isResetting ? "Zerando..." : "Confirmar e zerar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
