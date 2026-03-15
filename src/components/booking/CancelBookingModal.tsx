import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CancelBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  userType: "trader" | "provider";
  refundInfo?: {
    eligible: boolean;
    amount: number;
    percentage: number;
  };
}

export const CancelBookingModal = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  userType,
  refundInfo 
}: CancelBookingModalProps) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm(reason);
    setIsSubmitting(false);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            {userType === "trader" 
              ? "Are you sure you want to cancel this booking? The provider will be notified."
              : "Are you sure you want to cancel this booking? The trader will be notified."}
          </DialogDescription>
        </DialogHeader>

        {refundInfo && refundInfo.eligible && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Refund: {refundInfo.percentage}%</strong>
              <br />
              Amount: ${refundInfo.amount.toFixed(2)} will be refunded
            </AlertDescription>
          </Alert>
        )}

        {refundInfo && !refundInfo.eligible && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No refund applicable for this cancellation
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Reason for cancellation (optional)</Label>
          <Textarea
            id="reason"
            placeholder="Please provide a reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Booking
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Cancel Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
