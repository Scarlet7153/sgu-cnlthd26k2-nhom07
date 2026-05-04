import { useState } from "react";
import { Star, ThumbsUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  date: string;
  comment: string;
  helpful: number;
  verified: boolean;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
  averageRating: number;
  reviewCount: number;
}

// Demo reviews — replace with API when backend supports
const DEMO_REVIEWS: Review[] = [
  { id: "1", name: "Nguyễn Văn A", rating: 5, date: "15/03/2026", comment: "Sản phẩm rất tốt, hiệu năng vượt mong đợi. Đóng gói cẩn thận, giao hàng nhanh. Rất hài lòng!", helpful: 12, verified: true },
  { id: "2", name: "Trần Thị B", rating: 4, date: "10/03/2026", comment: "Chất lượng ổn, giá cả hợp lý. Tuy nhiên cần cải thiện thêm phần hướng dẫn sử dụng.", helpful: 5, verified: true },
  { id: "3", name: "Lê Minh C", rating: 5, date: "05/03/2026", comment: "Đã mua lần thứ 2 rồi. Luôn hài lòng với sản phẩm và dịch vụ của shop!", helpful: 8, verified: false },
  { id: "4", name: "Phạm Đức D", rating: 3, date: "01/03/2026", comment: "Sản phẩm tạm ổn, nhưng giao hàng hơi chậm so với cam kết. Sản phẩm hoạt động tốt.", helpful: 2, verified: true },
];

export default function ProductReviews({ productId, productName, averageRating, reviewCount }: ProductReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(DEMO_REVIEWS);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập", description: "Bạn cần đăng nhập để viết đánh giá.", variant: "destructive" });
      return;
    }
    if (!newComment.trim()) {
      toast({ title: "Vui lòng nhập nội dung", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newReview: Review = {
      id: Date.now().toString(),
      name: user.name || user.email,
      rating: newRating,
      date: new Date().toLocaleDateString("vi-VN"),
      comment: newComment.trim(),
      helpful: 0,
      verified: true,
    };

    setReviews((prev) => [newReview, ...prev]);
    setNewComment("");
    setNewRating(5);
    setShowForm(false);
    setSubmitting(false);
    toast({ title: "🎉 Đánh giá thành công!", description: "Cảm ơn bạn đã đánh giá sản phẩm." });
  };

  const handleHelpful = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r))
    );
  };

  // Rating distribution (calculated from reviews)
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, pct };
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : averageRating.toFixed(1);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Rating summary */}
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="text-center">
          <p className="text-5xl font-extrabold text-foreground">{avgRating}</p>
          <div className="mt-2 flex items-center justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i < Math.floor(Number(avgRating))
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{reviews.length} đánh giá</p>
        </div>
        <Separator orientation="vertical" className="hidden h-24 sm:block" />
        <div className="flex-1 space-y-2">
          {ratingDist.map(({ star, pct }) => (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-right text-muted-foreground">{star}</span>
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-xs text-muted-foreground">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Write review button / form */}
      <div className="mb-6">
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <MessageSquare className="h-4 w-4" /> Viết đánh giá
          </Button>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Đánh giá của bạn</h4>

            {/* Star selector */}
            <div className="flex items-center gap-1">
              <span className="mr-2 text-sm text-muted-foreground">Chọn số sao:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setNewRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= (hoveredStar || newRating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-foreground">{newRating}/5</span>
            </div>

            {/* Comment */}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? "Đang gửi..." : "Gửi đánh giá"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Review list */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {review.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{review.name}</p>
                {review.verified && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    ✓ Đã mua hàng
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{review.date}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className={`h-3.5 w-3.5 ${
                      j < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
              <button
                onClick={() => handleHelpful(review.id)}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Hữu ích ({review.helpful})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
