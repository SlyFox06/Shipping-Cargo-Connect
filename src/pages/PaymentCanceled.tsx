import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCanceled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <XCircle className="h-16 w-16 mx-auto text-warning" />
        <h1 className="text-2xl font-bold">Payment Canceled</h1>
        <p className="text-muted-foreground">
          Your payment was canceled. No charges were made to your account.
        </p>
        <Button onClick={() => navigate("/dashboard")} className="w-full">
          Return to Dashboard
        </Button>
      </Card>
    </div>
  );
}
