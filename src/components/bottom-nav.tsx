import { Link, useLocation } from "wouter";
import { Home, Siren, CalendarDays, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Hoje", icon: Home },
  { path: "/sos", label: "SOS", icon: Siren },
  { path: "/historico", label: "Histórico", icon: CalendarDays },
  { path: "/ajustes", label: "Ajustes", icon: Settings },
];

function isActive(location: string, path: string) {
  if (path === "/") return location === "/";
  return location === path || location.startsWith(path + "/");
}

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-background/95 backdrop-blur-md border-t border-border/40">
      <div className="flex items-center justify-around px-1 h-16">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isActive(location, path);
          return (
            <Link key={path} href={path}>
              <div
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all",
                  active
                    ? "text-primary"
                    : "text-muted-foreground/50 hover:text-muted-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    active ? "stroke-[2]" : "stroke-[1.5]",
                  )}
                />
                <span className="text-[10px] font-medium tracking-wide leading-tight">
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav() {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex flex-col w-16 border-r border-border/30 sticky top-0 h-[100dvh] py-8 shrink-0 items-center gap-1 bg-background/60">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const active = isActive(location, path);
        return (
          <Link key={path} href={path}>
            <div
              className={cn(
                "flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all w-12",
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50",
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  active ? "stroke-[2]" : "stroke-[1.5]",
                )}
              />
              <span className="text-[9px] font-medium text-center leading-tight">
                {label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
