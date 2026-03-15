import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ship, Package, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border backdrop-blur-sm bg-card/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ship className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ShipConnect
            </span>
          </div>
          <nav className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button 
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm text-foreground">Connecting Global Trade</span>
          </div>
          
          <h1 className="text-6xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-pulse">
              Ship Smarter,
            </span>
            <br />
            <span className="text-foreground">Trade Faster</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The modern logistics platform connecting container providers with traders worldwide. 
            Book containers, track shipments, and manage your entire supply chain in one place.
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              Start Booking
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary/20 hover:bg-primary/10 text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              List Your Containers
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all group">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Ship className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Global Network</h3>
            <p className="text-muted-foreground">
              Access containers across major shipping routes worldwide
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all group">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Tracking</h3>
            <p className="text-muted-foreground">
              Track your shipments with live updates and GPS location
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all group">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure Payments</h3>
            <p className="text-muted-foreground">
              Multi-currency support with 3D Secure compliance
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all group">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Booking</h3>
            <p className="text-muted-foreground">
              Book containers instantly with no approval delays
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <Card className="p-12 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-primary/20 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Logistics?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of providers and traders already using ShipConnect
          </p>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity text-lg px-12"
            onClick={() => navigate("/auth")}
          >
            Get Started Now
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
            <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span className="hidden sm:inline">|</span>
            <a href="/terms-and-conditions" className="hover:text-foreground transition-colors">Terms & Conditions</a>
            <span className="hidden sm:inline">|</span>
            <a href="/cancellation-and-refund" className="hover:text-foreground transition-colors">Cancellation & Refund Policy</a>
            <span className="hidden sm:inline">|</span>
            <a href="/shipping-policy" className="hover:text-foreground transition-colors">Shipping Policy</a>
            <span className="hidden sm:inline">|</span>
            <a href="/contact-us" className="hover:text-foreground transition-colors">Contact Us</a>
          </div>
          <p className="text-center text-muted-foreground">© 2025 ShipConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
