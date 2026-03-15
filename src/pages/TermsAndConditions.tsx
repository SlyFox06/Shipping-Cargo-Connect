import React from "react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Terms and Conditions</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            By accessing and using Ship Link Connect, you agree to be bound by these Terms and Conditions. 
            Please read them carefully before using our platform.
          </p>
          <p>
            Users must provide accurate and complete information during registration and when making bookings. 
            Any false or misleading information may result in account suspension or termination.
          </p>
          <p>
            Ship Link Connect serves as an intermediary platform connecting container providers with traders. 
            We facilitate the booking process but do not own or operate any containers. All bookings are 
            subject to provider approval and container availability.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent 
            activities, or misuse the platform. Users are responsible for maintaining the confidentiality of 
            their account credentials.
          </p>
          <p>
            Prices displayed on the platform are set by providers and may be subject to change. Payment terms, 
            cancellation policies, and refund conditions are governed by our separate policies and provider agreements.
          </p>
          <p>
            Ship Link Connect is not liable for any damages, delays, or losses arising from the use of our 
            platform or services provided by third-party container providers. Users agree to indemnify and 
            hold us harmless from any claims arising from their use of the platform.
          </p>
          <p>
            We reserve the right to modify these Terms and Conditions at any time. Continued use of the 
            platform after changes constitutes acceptance of the revised terms.
          </p>
        </div>
      </div>
    </div>
  );
}
