import type { ReactNode } from "react";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  return <>{children}</>;
}
