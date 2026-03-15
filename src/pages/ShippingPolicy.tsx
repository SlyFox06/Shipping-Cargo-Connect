import React from "react";

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Shipping Policy</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Ship Link Connect acts as an intermediary platform that connects traders with container providers 
            for cargo shipping services. This policy outlines the shipping process and responsibilities of 
            all parties involved.
          </p>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Provider Responsibilities</h2>
          <p>
            Container providers are responsible for:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Maintaining accurate container availability and specifications</li>
            <li>Ensuring containers meet quality and safety standards</li>
            <li>Managing shipment schedules and departure times</li>
            <li>Safe handling and transportation of cargo</li>
            <li>Timely delivery to the specified destination</li>
            <li>Providing tracking information and shipment updates</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Trader Responsibilities</h2>
          <p>
            Traders are responsible for:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Providing accurate cargo details and documentation</li>
            <li>Ensuring cargo complies with shipping regulations</li>
            <li>Making timely payments as per booking terms</li>
            <li>Collecting cargo at the destination port within the specified timeframe</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Tracking and Updates</h2>
          <p>
            Traders can track their shipments in real-time through their dashboard. Providers are required 
            to update shipment status at key milestones including departure, transit, and arrival.
          </p>
          
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Delays and Exceptions</h2>
          <p>
            Ship Link Connect and container providers are not liable for delays caused by factors beyond 
            our control, including but not limited to:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Customs inspections and clearance procedures</li>
            <li>Adverse weather conditions and natural disasters</li>
            <li>Port congestion or strikes</li>
            <li>Government restrictions or regulatory changes</li>
          </ul>
          
          <p className="mt-4">
            In case of significant delays, providers will communicate with traders through the platform's 
            messaging system. Ship Link Connect facilitates communication but does not control shipment schedules.
          </p>
          <p className="mt-6 text-foreground">
            For shipping-related queries, contact: <strong>support@shiplinkconnect.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
