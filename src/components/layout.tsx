import React from "react";
import { motion } from "framer-motion";
import { BottomNav, SideNav } from "@/components/bottom-nav";
import { useAppearance } from "@/hooks/use-appearance";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { appearance } = useAppearance();

  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full flex justify-center",
        appearance === "candle" ? "bg-[#1a0b05]" : "bg-[#E5E0D8]"
      )}
    >
      <div className="w-full max-w-[480px] bg-background shadow-2xl overflow-x-hidden flex min-h-[100dvh]">
        <SideNav />

        <div className="flex-1 flex flex-col overflow-x-hidden">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col pb-16 md:pb-0"
          >
            {children}
          </motion.div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
