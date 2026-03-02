import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-bold text-foreground">Trang không tồn tại</h2>
        <p className="mt-2 text-muted-foreground">Xin lỗi, trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Về trang chủ
        </a>
      </div>
    </div>
  );
};

export default NotFound;
