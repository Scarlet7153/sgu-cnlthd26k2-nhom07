import { Link } from "react-router-dom";
import { Category } from "@/types/product.types";
import { Cpu, CircuitBoard, Monitor, MemoryStick, HardDrive, Zap, Box, Fan } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Cpu, CircuitBoard, Monitor, MemoryStick, HardDrive, Zap, Box, Fan,
};

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  const Icon = iconMap[category.icon] || Box;

  return (
    <Link
      to={`/products?category=${category.id}`}
      className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs font-medium leading-tight text-card-foreground">{category.name.split(" - ").pop()}</span>
    </Link>
  );
}
