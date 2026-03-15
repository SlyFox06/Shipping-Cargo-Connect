import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);

  const sessionId = searchParams.get("session_id");
  const paymentId = searchParams.get("payment_id");

  useEffect(() => {
    if (sessionId && paymentId) {
      verifyPayment();
    }
  }, [sessionId, paymentId]);

  const verifyPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId, paymentId },
      });

      if (error) throw error;

      if (data?.success) {
        setSuccess(true);
        toast.success("Payment successful!");
      } else {
        toast.error("Payment verification failed");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error("Failed to verify payment");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {verifying ? (
          <>
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Verifying Payment...</h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment
            </p>
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
            <h1 className="text-2xl font-bold">Payment Successful!</h1>
            <p className="text-muted-foreground">
              Your booking has been confirmed. You will receive a confirmation email shortly.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-destructive">Verification Failed</h1>
            <p className="text-muted-foreground">
              We couldn't verify your payment. Please contact support.
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
