import { Clock } from "lucide-react";

interface StatusHistoryEntry {
  status: string;
  note?: string;
  changeBy?: string;
  createdAt: string;
}

interface OrderTimelineProps {
  historyStatus: StatusHistoryEntry[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao hàng",
  delivered: "Đã giao hàng",
  cancelled: "Đã hủy",
};

const STATUS_DOT_COLOR: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-blue-400",
  shipping: "bg-purple-400",
  delivered: "bg-green-400",
  cancelled: "bg-red-400",
};

export default function OrderTimeline({ historyStatus }: OrderTimelineProps) {
  if (!historyStatus || historyStatus.length === 0) return null;

  // Sort entries by createdAt ascending (oldest first)
  const sorted = [...historyStatus].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-card-foreground">
        <Clock className="h-4 w-4 text-primary" /> Lịch sử đơn hàng
      </h3>
      <div className="relative ml-2">
        {sorted.map((entry, i) => {
          const isLast = i === sorted.length - 1;
          const dotColor = STATUS_DOT_COLOR[entry.status] || "bg-muted-foreground";

          return (
            <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[7px] top-4 h-full w-0.5 bg-border" />
              )}
              {/* Dot */}
              <div className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-background ${dotColor} ring-2 ring-background`} />
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isLast ? "text-foreground" : "text-muted-foreground"}`}>
                  {STATUS_LABEL[entry.status] || entry.status}
                </p>
                {entry.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {new Date(entry.createdAt).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {entry.changeBy && entry.changeBy !== "system" && (
                    <span> · bởi {entry.changeBy}</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
