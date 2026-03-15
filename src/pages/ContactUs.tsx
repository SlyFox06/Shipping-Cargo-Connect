import React from "react";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Contact Us</h1>
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p>
            Have questions, need support, or interested in partnership opportunities? We're here to help! 
            Get in touch with the Ship Link Connect team through any of the following channels.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <Mail className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Email</h3>
                <p>support@shiplinkconnect.com</p>
                <p className="text-sm mt-1">We typically respond within 24 hours</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <Phone className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Phone</h3>
                <p>+91-XXXXXXXXXX</p>
                <p className="text-sm mt-1">Mon-Sat, 9:00 AM - 6:00 PM IST</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <MapPin className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Address</h3>
                <p>Pune, Maharashtra, India</p>
                <p className="text-sm mt-1">Headquarters</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <Clock className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Working Hours</h3>
                <p>Monday - Saturday</p>
                <p className="text-sm mt-1">9:00 AM - 6:00 PM IST</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-6 rounded-lg border border-border bg-card">
            <h2 className="text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">How do I book a container?</h3>
                <p className="text-sm">Sign up as a trader, search for available containers, and submit a booking request through your dashboard.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">How can I list my containers?</h3>
                <p className="text-sm">Register as a provider, complete your profile, and add your container inventory through the provider dashboard.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">What payment methods are accepted?</h3>
                <p className="text-sm">We accept payments through Razorpay, including UPI, credit cards, debit cards, and net banking.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">How do I track my shipment?</h3>
                <p className="text-sm">Log in to your trader dashboard to view real-time tracking information and shipment status updates.</p>
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-center">
            For urgent matters or technical support, please email us directly at{" "}
            <strong className="text-foreground">support@shiplinkconnect.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
