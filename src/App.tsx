import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AIAssistant } from "@/components/AIAssistant";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import TraderDashboard from "./pages/TraderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import NotFound from "./pages/NotFound";

// Policy pages
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import CancellationAndRefund from "./pages/CancellationAndRefund";
import ShippingPolicy from "./pages/ShippingPolicy";
import ContactUs from "./pages/ContactUs";

// Admin pages
import AdminUsers from "./pages/admin/Users";
import AdminContainers from "./pages/admin/Containers";
import AdminBookings from "./pages/admin/Bookings";
import AdminPayments from "./pages/admin/Payments";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminActivityLogs from "./pages/admin/ActivityLogs";
import AdminMessages from "./pages/admin/Messages";
import AdminSettings from "./pages/admin/Settings";

// Provider pages
import ProviderContainers from "./pages/provider/Containers";
import ProviderBookings from "./pages/provider/Bookings";
import ProviderPayments from "./pages/provider/Payments";
import ProviderEarnings from "./pages/provider/Earnings";
import ProviderRevenue from "./pages/provider/Revenue";
import ProviderSettings from "./pages/provider/Settings";

// Trader pages
import TraderSearch from "./pages/trader/Search";
import TraderBookings from "./pages/trader/Bookings";
import TraderPayments from "./pages/trader/Payments";
import TraderInvoices from "./pages/trader/Invoices";
import TraderSettings from "./pages/trader/Settings";

// Common pages
import CommonMessages from "./pages/CommonMessages";
import CommonAnalytics from "./pages/CommonAnalytics";
import CommonSettings from "./pages/CommonSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Admin Routes */}
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/admin/users" element={<AdminUsers />} />
          <Route path="/dashboard/admin/containers" element={<AdminContainers />} />
          <Route path="/dashboard/admin/bookings" element={<AdminBookings />} />
          <Route path="/dashboard/admin/payments" element={<AdminPayments />} />
          <Route path="/dashboard/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/dashboard/admin/messages" element={<AdminMessages />} />
          <Route path="/dashboard/admin/logs" element={<AdminActivityLogs />} />
          <Route path="/dashboard/admin/settings" element={<AdminSettings />} />
          
          {/* Provider Routes */}
          <Route path="/dashboard/provider" element={<ProviderDashboard />} />
          <Route path="/dashboard/provider/containers" element={<ProviderContainers />} />
          <Route path="/dashboard/provider/bookings" element={<ProviderBookings />} />
          <Route path="/dashboard/provider/payments" element={<ProviderPayments />} />
          <Route path="/dashboard/provider/earnings" element={<ProviderEarnings />} />
          <Route path="/dashboard/provider/revenue" element={<ProviderRevenue />} />
          <Route path="/dashboard/provider/analytics" element={<CommonAnalytics />} />
          <Route path="/dashboard/provider/messages" element={<CommonMessages />} />
          <Route path="/dashboard/provider/settings" element={<ProviderSettings />} />
          
          {/* Trader Routes */}
          <Route path="/dashboard/trader" element={<TraderDashboard />} />
          <Route path="/dashboard/trader/search" element={<TraderSearch />} />
          <Route path="/dashboard/trader/bookings" element={<TraderBookings />} />
          <Route path="/dashboard/trader/payments" element={<TraderPayments />} />
          <Route path="/dashboard/trader/invoices" element={<TraderInvoices />} />
          <Route path="/dashboard/trader/analytics" element={<CommonAnalytics />} />
          <Route path="/dashboard/trader/messages" element={<CommonMessages />} />
          <Route path="/dashboard/trader/settings" element={<TraderSettings />} />
          
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
          
          {/* Policy Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/cancellation-and-refund" element={<CancellationAndRefund />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/contact-us" element={<ContactUs />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        <AIAssistant />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
