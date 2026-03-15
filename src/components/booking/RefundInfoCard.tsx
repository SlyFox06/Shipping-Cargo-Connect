import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle, XCircle } from "lucide-react";

interface RefundInfoCardProps {
  refundStatus: string;
  refundAmount: number;
  refundPercentage: number;
  refundProcessedAt?: string;
  refundReason?: string;
}

export const RefundInfoCard = ({
  refundStatus,
  refundAmount,
  refundPercentage,
  refundProcessedAt,
  refundReason
}: RefundInfoCardProps) => {
  const getStatusBadge = () => {
    switch (refundStatus) {
      case "refunded_full":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Full Refund</Badge>;
      case "refunded_partial":
        return <Badge className="bg-yellow-500"><CheckCircle className="h-3 w-3 mr-1" />Partial Refund</Badge>;
      case "refunded_by_provider":
        return <Badge className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Refunded by Provider</Badge>;
      case "not_applicable":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />No Refund</Badge>;
      default:
        return null;
    }
  };

  if (refundStatus === "not_applicable" || refundAmount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Refund Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status:</span>
          {getStatusBadge()}
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Refund Amount:</span>
          <span className="font-semibold text-lg">${refundAmount.toFixed(2)}</span>
        </div>

        {refundPercentage > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Refund Percentage:</span>
            <span className="font-semibold">{refundPercentage}%</span>
          </div>
        )}

        {refundProcessedAt && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Processed:</span>
            <span className="text-sm">{new Date(refundProcessedAt).toLocaleDateString()}</span>
          </div>
        )}

        {refundReason && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-1">Reason:</p>
            <p className="text-sm">{refundReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
