import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface GuestRouteProps {
  children: ReactNode;
  fallback?: string;
}

export function GuestRoute({ children, fallback = "/" }: GuestRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-primary-foreground"></div>
          <p className="mt-4 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
