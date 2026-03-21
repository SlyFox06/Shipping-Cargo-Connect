import { supabase } from "@/integrations/supabase/client";

export interface Milestone {
  id: string;
  milestone: string;
  status: string;
  completed_date: string | null;
  location: string | null;
  notes: string | null;
}

export const shipmentService = {
  async getMilestones(bookingId: string): Promise<Milestone[]> {
    const { data, error } = await supabase
      .from("shipment_milestones")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at");

    if (error) throw error;
    return data || [];
  },

  subscribeToMilestones(bookingId: string, onUpdate: () => void) {
    const channel = supabase
      .channel(`milestones-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shipment_milestones",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
