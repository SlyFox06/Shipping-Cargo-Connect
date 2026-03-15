import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Save, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PaymentDetailsFormProps {
  userRole: "trader" | "provider";
  userId: string;
}

export const PaymentDetailsForm = ({ userRole, userId }: PaymentDetailsFormProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    upi_id: "",
    swift_code: "",
    paypal_email: "",
    currency_preference: "USD",
    payment_notes: "",
    payment_verified: false,
  });

  useState(() => {
    fetchPaymentDetails();
  });

  const fetchPaymentDetails = async () => {
    try {
      const tableName = userRole === "provider" ? "providers" : "profiles";
      const query = userRole === "provider" 
        ? supabase.from("providers").select("*").eq("user_id", userId).single()
        : supabase.from("profiles").select("*").eq("id", userId).single();

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setPaymentDetails({
          bank_account_name: data.bank_account_name || "",
          bank_account_number: data.bank_account_number || "",
          bank_ifsc_code: data.bank_ifsc_code || "",
          bank_name: data.bank_name || "",
          upi_id: data.upi_id || "",
          swift_code: data.swift_code || "",
          paypal_email: data.paypal_email || "",
          currency_preference: data.currency_preference || "USD",
          payment_notes: data.payment_notes || "",
          payment_verified: data.payment_verified || false,
        });
      }
    } catch (error: any) {
      console.error("Error fetching payment details:", error);
    }
  };

  const handlePaymentDetailsUpdate = async () => {
    // Validation
    if (paymentDetails.bank_account_number && !/^\d+$/.test(paymentDetails.bank_account_number)) {
      toast({
        title: "Error",
        description: "Please enter a valid account number (numbers only)",
        variant: "destructive",
      });
      return;
    }

    if (paymentDetails.paypal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentDetails.paypal_email)) {
      toast({
        title: "Error",
        description: "Please enter a valid PayPal email address",
        variant: "destructive",
      });
      return;
    }

    if (paymentDetails.upi_id && !/^[\w.-]+@[\w.-]+$/.test(paymentDetails.upi_id)) {
      toast({
        title: "Error",
        description: "Please enter a valid UPI ID (e.g., username@bank)",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData = {
        bank_account_name: paymentDetails.bank_account_name,
        bank_account_number: paymentDetails.bank_account_number,
        bank_ifsc_code: paymentDetails.bank_ifsc_code,
        bank_name: paymentDetails.bank_name,
        upi_id: paymentDetails.upi_id,
        swift_code: paymentDetails.swift_code,
        paypal_email: paymentDetails.paypal_email,
        currency_preference: paymentDetails.currency_preference,
        payment_notes: paymentDetails.payment_notes,
      };

      const { error } = userRole === "provider"
        ? await supabase.from("providers").update(updateData).eq("user_id", user.id)
        : await supabase.from("profiles").update(updateData).eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment details updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Payment Details</h3>
        {paymentDetails.payment_verified && (
          <span className="ml-auto text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="bank_account_name">Bank Account Holder Name</Label>
          <Input
            id="bank_account_name"
            value={paymentDetails.bank_account_name}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, bank_account_name: e.target.value })}
            placeholder="Enter account holder name"
          />
        </div>

        <div>
          <Label htmlFor="bank_name">Bank Name</Label>
          <Input
            id="bank_name"
            value={paymentDetails.bank_name}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, bank_name: e.target.value })}
            placeholder="Enter bank name"
          />
        </div>

        <div>
          <Label htmlFor="bank_account_number">Bank Account Number</Label>
          <Input
            id="bank_account_number"
            value={paymentDetails.bank_account_number}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, bank_account_number: e.target.value })}
            placeholder="Enter account number"
            type="text"
          />
        </div>

        <div>
          <Label htmlFor="bank_ifsc_code">IFSC Code / Routing Number</Label>
          <Input
            id="bank_ifsc_code"
            value={paymentDetails.bank_ifsc_code}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, bank_ifsc_code: e.target.value })}
            placeholder="Enter IFSC/routing code"
          />
        </div>

        <div>
          <Label htmlFor="swift_code">SWIFT/BIC Code (International)</Label>
          <Input
            id="swift_code"
            value={paymentDetails.swift_code}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, swift_code: e.target.value })}
            placeholder="Enter SWIFT code"
          />
        </div>

        <div>
          <Label htmlFor="currency_preference">Preferred Currency</Label>
          <Select
            value={paymentDetails.currency_preference}
            onValueChange={(value) => setPaymentDetails({ ...paymentDetails, currency_preference: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
              <SelectItem value="GBP">GBP - British Pound</SelectItem>
              <SelectItem value="INR">INR - Indian Rupee</SelectItem>
              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
              <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
              <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
              <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
              <SelectItem value="AED">AED - UAE Dirham</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="upi_id">UPI ID (India)</Label>
          <Input
            id="upi_id"
            value={paymentDetails.upi_id}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, upi_id: e.target.value })}
            placeholder="username@bank"
          />
          <p className="text-xs text-muted-foreground mt-1">For Indian bank transfers</p>
        </div>

        <div>
          <Label htmlFor="paypal_email">PayPal Email</Label>
          <Input
            id="paypal_email"
            type="email"
            value={paymentDetails.paypal_email}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, paypal_email: e.target.value })}
            placeholder="paypal@example.com"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="payment_notes">Additional Payment Notes</Label>
          <Textarea
            id="payment_notes"
            value={paymentDetails.payment_notes}
            onChange={(e) => setPaymentDetails({ ...paymentDetails, payment_notes: e.target.value })}
            placeholder="Add any special instructions or notes for payment processing"
            rows={3}
          />
        </div>

        <div className="md:col-span-2">
          <Button onClick={handlePaymentDetailsUpdate} disabled={loading} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Payment Details
          </Button>
        </div>
      </div>
    </Card>
  );
};
