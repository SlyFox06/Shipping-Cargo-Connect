import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  type: 'booking_created' | 'booking_approved' | 'booking_rejected' | 'booking_cancelled' | 'shipment_started' | 'shipment_delivered' | 'refund_processed' | 'new_message';
  bookingId?: string;
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, type, bookingId, data }: NotificationRequest = await req.json();

    console.log(`Processing notification for user ${userId}, type: ${type}`);

    // Get user profile and preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, email_notifications_enabled, email_booking_updates, email_message_alerts, email_refund_updates')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user has email notifications enabled
    if (!profile.email_notifications_enabled) {
      console.log("User has email notifications disabled");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled for user" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check specific notification type preferences
    const typePreferences = {
      'booking_created': profile.email_booking_updates,
      'booking_approved': profile.email_booking_updates,
      'booking_rejected': profile.email_booking_updates,
      'booking_cancelled': profile.email_booking_updates,
      'shipment_started': profile.email_booking_updates,
      'shipment_delivered': profile.email_booking_updates,
      'refund_processed': profile.email_refund_updates,
      'new_message': profile.email_message_alerts,
    };

    if (!typePreferences[type]) {
      console.log(`User has ${type} notifications disabled`);
      return new Response(
        JSON.stringify({ message: `${type} notifications disabled for user` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate email content based on type
    const emailContent = generateEmailContent(type, data);

    // Send email using the send-email function
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: profile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        type: type,
      }
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully to:", profile.email);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

function generateEmailContent(type: string, data: any): { subject: string; html: string } {
  const templates = {
    'booking_created': {
      subject: 'New Booking Request Received',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Booking Request</h2>
          <p>You have received a new booking request.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Route:</strong> ${data.route}</p>
            <p><strong>Cargo:</strong> ${data.cargo}</p>
            <p><strong>Price:</strong> $${data.price}</p>
          </div>
          <p>Please log in to your dashboard to review and approve this booking.</p>
        </div>
      `
    },
    'booking_approved': {
      subject: 'Your Booking Was Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">✅ Booking Approved</h2>
          <p>Great news! Your booking has been approved.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Container:</strong> ${data.container}</p>
            <p><strong>Route:</strong> ${data.route}</p>
          </div>
          <p>You can now proceed with payment to confirm your booking.</p>
        </div>
      `
    },
    'booking_rejected': {
      subject: 'Your Booking Was Rejected',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">Booking Rejected</h2>
          <p>Unfortunately, your booking request has been rejected.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
          </div>
          <p>You can search for other available containers.</p>
        </div>
      `
    },
    'booking_cancelled': {
      subject: 'Booking Cancelled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Booking Cancelled</h2>
          <p>A booking has been cancelled.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Cancelled By:</strong> ${data.cancelledBy}</p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
            ${data.refundAmount ? `<p><strong>Refund Amount:</strong> $${data.refundAmount}</p>` : ''}
          </div>
        </div>
      `
    },
    'shipment_started': {
      subject: 'Shipment Has Started',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🚢 Shipment Started</h2>
          <p>Your shipment is now in transit.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Route:</strong> ${data.route}</p>
          </div>
          <p>You can track your shipment in real-time from your dashboard.</p>
        </div>
      `
    },
    'shipment_delivered': {
      subject: 'Shipment Delivered Successfully',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">✅ Shipment Delivered</h2>
          <p>Your shipment has been delivered successfully!</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Delivered On:</strong> ${data.deliveredDate}</p>
          </div>
          <p>Thank you for using our platform!</p>
        </div>
      `
    },
    'refund_processed': {
      subject: 'Refund Processed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">💵 Refund Processed</h2>
          <p>Your refund has been processed successfully.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Number:</strong> ${data.bookingNumber}</p>
            <p><strong>Refund Amount:</strong> $${data.refundAmount}</p>
            <p><strong>Refund Percentage:</strong> ${data.refundPercentage}%</p>
          </div>
          <p>The amount will be credited to your original payment method within 5-7 business days.</p>
        </div>
      `
    },
    'new_message': {
      subject: 'New Message on Cargo Booking',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">💬 New Message</h2>
          <p>You have received a new message regarding your booking.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${data.senderName}</p>
            <p><strong>Booking:</strong> ${data.bookingNumber}</p>
          </div>
          <p>Please log in to your dashboard to view and respond to the message.</p>
        </div>
      `
    }
  };

  return templates[type as keyof typeof templates] || {
    subject: 'Notification',
    html: '<p>You have a new notification.</p>'
  };
}

serve(handler);
