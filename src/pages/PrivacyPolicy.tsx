import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Privacy Policy</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Ship Link Connect values your privacy and is committed to protecting your personal information. 
            This Privacy Policy outlines how we collect, use, and safeguard your data when you use our platform.
          </p>
          <p>
            We only collect essential information necessary for booking containers and facilitating communication 
            between traders and providers. This includes your name, email address, phone number, and business details.
          </p>
          <p>
            Your data is encrypted using industry-standard security protocols and stored securely on our servers. 
            We never share your personal information with third parties without your explicit consent, except where 
            required by law or necessary to fulfill our services.
          </p>
          <p>
            We comply with all applicable data protection regulations, including GDPR and local data privacy laws. 
            You have the right to access, modify, or delete your personal information at any time through your 
            account settings or by contacting our support team.
          </p>
          <p>
            By using Ship Link Connect, you consent to the collection and use of your information as described 
            in this policy. We may update this Privacy Policy periodically, and any changes will be communicated 
            to registered users.
          </p>
          <p className="mt-6 text-foreground">
            For any privacy-related queries, contact: <strong>support@shiplinkconnect.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
