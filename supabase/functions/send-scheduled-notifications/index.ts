import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current date and 48 hours from now
    const now = new Date();
    const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const fortyEightHoursFormatted = fortyEightHoursLater.toISOString().split('T')[0];

    // Find containers departing in 48 hours
    const { data: departingContainers, error: containerError } = await supabase
      .from('containers')
      .select(`
        id,
        container_type,
        origin,
        destination,
        departure_date,
        bookings!inner(
          id,
          trader_id,
          booking_number,
          status
        )
      `)
      .eq('departure_date', fortyEightHoursFormatted)
      .in('bookings.status', ['confirmed', 'pending']);

    if (containerError) throw containerError;

    // Send departure notifications
    for (const container of departingContainers || []) {
      for (const booking of container.bookings) {
        await supabase.rpc('create_notification', {
          p_user_id: booking.trader_id,
          p_type: 'departure_reminder',
          p_title: '⏰ Container Departing Soon',
          p_message: `Your container (${container.container_type}) from ${container.origin} to ${container.destination} departs in 48 hours!`,
          p_link: '/dashboard/trader/bookings'
        });
      }
    }

    // Find bookings with approaching delivery deadlines (2 days before)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const twoDaysFormatted = twoDaysFromNow.toISOString().split('T')[0];

    const { data: upcomingDeadlines, error: deadlineError } = await supabase
      .from('bookings')
      .select('id, trader_id, booking_number, delivery_deadline')
      .eq('delivery_deadline', twoDaysFormatted)
      .in('status', ['confirmed', 'in_transit']);

    if (deadlineError) throw deadlineError;

    // Send deadline notifications
    for (const booking of upcomingDeadlines || []) {
      await supabase.rpc('create_notification', {
        p_user_id: booking.trader_id,
        p_type: 'deadline_reminder',
        p_title: '📅 Delivery Deadline Approaching',
        p_message: `Booking ${booking.booking_number} delivery deadline is in 2 days!`,
        p_link: '/dashboard/trader/bookings'
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        departureNotifications: departingContainers?.length || 0,
        deadlineNotifications: upcomingDeadlines?.length || 0
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending notifications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
