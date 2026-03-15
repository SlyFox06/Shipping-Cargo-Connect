import React from "react";

export default function CancellationAndRefund() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Cancellation and Refund Policy</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Ship Link Connect understands that plans may change. This policy outlines the conditions under 
            which bookings can be cancelled and refunds can be processed.
          </p>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Cancellation Policy</h2>
          <p>
            Cancellations can be made through your dashboard before the shipment process begins. Once the 
            container has been dispatched or the shipment is in transit, cancellations are not permitted.
          </p>
          <p>
            Both traders and providers have the right to cancel bookings under certain conditions. Traders 
            can cancel before provider confirmation, while providers can cancel if they are unable to fulfill 
            the booking requirements.
          </p>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Refund Policy</h2>
          <p>
            Refund eligibility depends on the timing of the cancellation:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Cancellation before provider acceptance: Full refund (100%)</li>
            <li>Cancellation within 24 hours after acceptance: 90% refund</li>
            <li>Cancellation 1-3 days after acceptance: 75% refund</li>
            <li>Cancellation 3+ days after acceptance: 50% refund</li>
            <li>Cancellation within 24 hours of departure: No refund</li>
            <li>Provider-initiated cancellations: Full refund (100%)</li>
          </ul>
          
          <p className="mt-4">
            Refunds, if applicable, will be processed within 7-10 business days after provider confirmation 
            and verification of the cancellation request. The refunded amount will be credited to the original 
            payment method used during booking.
          </p>
          <p>
            No refunds will be issued once the shipment is in transit or has been delivered. In case of 
            disputes, please contact our support team for resolution.
          </p>
          <p className="mt-6 text-foreground">
            For refund inquiries, contact: <strong>support@shiplinkconnect.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
