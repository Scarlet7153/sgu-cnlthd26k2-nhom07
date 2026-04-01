import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

const tabs = [
  {
    label: "Khung chat",
    to: "/ai-advisor",
    isActive: (path: string) => path === "/ai-advisor",
  },
  {
    label: "Bảng cấu hình",
    to: "/ai-advisor/build",
    isActive: (path: string) => path.startsWith("/ai-advisor/build"),
  },
  {
    label: "Thanh toán",
    to: "/checkout",
    isActive: (path: string) => path.startsWith("/checkout"),
  },
];

export default function AdvisorNav() {
  const location = useLocation();

  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2">
      {tabs.map((tab) => {
        const active = tab.isActive(location.pathname);
        return (
          <Button key={tab.to} asChild size="sm" variant={active ? "default" : "outline"}>
            <Link to={tab.to} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
