import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";

const HomePage = lazy(() => import("./pages/HomePage"));
const ProductListPage = lazy(() => import("./pages/ProductListPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const PcBuilderPage = lazy(() => import("./pages/PcBuilderPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const OTPVerificationPage = lazy(() => import("./pages/OTPVerificationPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const OrderSuccessPage = lazy(() => import("./pages/OrderSuccessPage"));
const PaymentResultPage = lazy(() => import("./pages/PaymentResultPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LoadingSkeleton count={8} />
    </div>
  );
}

function AppRoutes() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Prefetch categories and brands on app startup
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["categories-menu"],
      queryFn: async () => {
        const response = await fetch("/api/categories");
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data = await response.json();
        return data.data || [];
      },
      staleTime: 10 * 60 * 1000,
    });

    queryClient.prefetchQuery({
      queryKey: ["brands"],
      queryFn: async () => {
        const response = await fetch("/api/products/brands");
        if (!response.ok) throw new Error("Failed to fetch brands");
        const data = await response.json();
        return data.data || [];
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return (
    <div className="flex min-h-screen flex-col">
      {!isAdminRoute && <Header />}
      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pc-builder" element={<PcBuilderPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-otp" element={<OTPVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/order/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
            <Route path="/order-success" element={<ProtectedRoute><OrderSuccessPage /></ProtectedRoute>} />
            <Route path="/payment/result" element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="categories" element={<AdminCategories />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
