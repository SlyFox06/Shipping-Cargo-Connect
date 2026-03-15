import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Conversation {
  id: string;
  trader_id: string;
  provider_id: string;
  container_id: string | null;
  booking_id: string | null;
  status: string;
  other_user_id: string;
  other_user_name: string;
  other_user_role: string;
  last_message: string;
  last_message_time: Date;
  unread_count: number;
  container_info: string;
}

interface ChatListProps {
  userId: string;
  userRole: string;
  onSelectConversation: (conversationId: string, otherUserId: string, otherUserName: string) => void;
  selectedConversationId: string | null;
}

export const ChatList = ({ userId, userRole, onSelectConversation, selectedConversationId }: ChatListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();

    // Real-time subscription for new messages and conversations
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole]);

  const fetchConversations = async () => {
    try {
      setLoading(true);

      // Fetch conversations where user is either trader or provider
      const { data: convos, error: convosError } = await supabase
        .from('conversations')
        .select(`
          *,
          containers(container_type, origin, destination),
          bookings(booking_number)
        `)
        .or(`trader_id.eq.${userId},provider_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (convosError) throw convosError;

      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Fetch details for each conversation
      const conversationsWithDetails = await Promise.all(
        convos.map(async (convo: any) => {
          const isTrader = convo.trader_id === userId;
          const otherUserId = isTrader ? convo.provider_id : convo.trader_id;
          const otherUserRole = isTrader ? 'provider' : 'trader';

          // Fetch other user's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, company_name')
            .eq('id', otherUserId)
            .single();

          const otherUserName = profile?.company_name || profile?.full_name || 'Unknown User';

           // Use conversation's unread counts directly instead of calculating
           const unreadCount = isTrader ? (convo.unread_trader_count || 0) : (convo.unread_provider_count || 0);

           // Container info
           const containerInfo = convo.containers
             ? `${convo.containers.container_type}: ${convo.containers.origin} → ${convo.containers.destination}`
             : convo.bookings?.booking_number || 'No booking';

           // Use conversation's last_message_preview if available
           const lastMessage = convo.last_message_preview || (await (async () => {
             const { data: lastMsg } = await supabase
               .from('chat_messages')
               .select('message')
               .eq('conversation_id', convo.id)
               .order('created_at', { ascending: false })
               .limit(1)
               .maybeSingle();
             return lastMsg?.message || 'No messages yet';
           })());

           return {
             id: convo.id,
             trader_id: convo.trader_id,
             provider_id: convo.provider_id,
             container_id: convo.container_id,
             booking_id: convo.booking_id,
             status: convo.status,
             other_user_id: otherUserId,
             other_user_name: otherUserName,
             other_user_role: otherUserRole,
             last_message: lastMessage,
             last_message_time: new Date(convo.updated_at),
             unread_count: unreadCount,
             container_info: containerInfo,
           };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((convo) =>
    convo.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    convo.container_info.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays < 7) {
      return format(date, 'EEE');
    } else {
      return format(date, 'MMM d');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500';
      case 'booked':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card className="h-full p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Loading conversations...</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold mb-3">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? 'No conversations found' : 'No active conversations yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {userRole === 'trader' 
                ? 'Start by searching for containers and contacting providers'
                : 'Conversations will appear here when traders contact you'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo.id, convo.other_user_id, convo.other_user_name)}
                className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedConversationId === convo.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {convo.other_user_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold truncate">{convo.other_user_name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(convo.last_message_time)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-1 truncate">
                      {convo.container_info}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {convo.last_message}
                      </p>
                      {convo.unread_count > 0 && (
                        <Badge variant="default" className="ml-2">
                          {convo.unread_count}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="mt-2">
                      <Badge className={`${getStatusColor(convo.status)} text-white`}>
                        {convo.status.charAt(0).toUpperCase() + convo.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
