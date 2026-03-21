import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatService = {
  async getStreamingResponse(
    message: string,
    onChunk: (content: string) => void,
    onError: (error: any) => void
  ) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      // Get user role
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message,
          userId: session.user.id,
          userRole: userRole?.role || "trader"
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.reply) {
        onChunk(data.reply);
      }
    } catch (error) {
      onError(error);
    }
  }
};
