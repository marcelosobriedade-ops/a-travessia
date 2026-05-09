import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fallbackTimer = window.setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
    }, 4000);

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Erro ao carregar sessão:", error);
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
        window.clearTimeout(fallbackTimer);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
  };
}
