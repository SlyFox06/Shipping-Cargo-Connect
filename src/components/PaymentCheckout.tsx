import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

interface PaymentCheckoutProps {
  bookingId: string;
  amount: number;
  currency?: string;
}

export const PaymentCheckout = ({ bookingId, amount, currency = "USD" }: PaymentCheckoutProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          bookingId,
          amount,
          currency,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout...");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error("Failed to create checkout session");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Payment Details</h3>
          <p className="text-sm text-muted-foreground">Secure payment - Pay with Card or UPI</p>
        </div>
        
        <div className="flex justify-between items-center py-4 border-t border-b">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="text-2xl font-bold">
            {currency} {amount.toFixed(2)}
          </span>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Proceed to Payment
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Your payment information is secure and encrypted
        </p>
      </div>
    </Card>
  );
};
