import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, MessageSquare, Flag, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Conversation {
  id: string;
  trader_id: string;
  provider_id: string;
  booking_id: string | null;
  container_id: string | null;
  last_message_preview: string;
  updated_at: string;
  is_flagged: boolean;
  flag_reason: string | null;
  trader_name: string;
  provider_name: string;
  booking_number: string | null;
  unread_trader_count: number;
  unread_provider_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  sender_name: string;
  sender_role: string;
}

const AdminMessages = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [flagReason, setFlagReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'admin') {
        navigate('/dashboard');
        return;
      }
      fetchConversations();
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    filterConversations();
  }, [conversations, searchTerm, filterBy]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      // Fetch all conversations with user details
      const { data: convos, error } = await supabase
        .from('conversations')
        .select(`
          *,
          bookings(booking_number)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch trader and provider names
      const conversationsWithNames = await Promise.all(
        (convos || []).map(async (convo: any) => {
          const [traderProfile, providerProfile] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', convo.trader_id).single(),
            supabase.from('profiles').select('full_name').eq('id', convo.provider_id).single()
          ]);

          return {
            ...convo,
            trader_name: traderProfile.data?.full_name || 'Unknown Trader',
            provider_name: providerProfile.data?.full_name || 'Unknown Provider',
            booking_number: convo.bookings?.booking_number || null
          };
        })
      );

      setConversations(conversationsWithNames);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const filterConversations = () => {
    let filtered = conversations;

    // Filter by type
    if (filterBy === "flagged") {
      filtered = filtered.filter(c => c.is_flagged);
    } else if (filterBy === "with_booking") {
      filtered = filtered.filter(c => c.booking_id !== null);
    } else if (filterBy === "pre_booking") {
      filtered = filtered.filter(c => c.booking_id === null);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.trader_name.toLowerCase().includes(term) ||
        c.provider_name.toLowerCase().includes(term) ||
        c.booking_number?.toLowerCase().includes(term) ||
        c.last_message_preview?.toLowerCase().includes(term)
      );
    }

    setFilteredConversations(filtered);
  };

  const viewConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setFlagReason(conversation.flag_reason || "");
    
    // Fetch all messages in conversation
    try {
      const { data: msgs, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender names
      const messagesWithNames = await Promise.all(
        (msgs || []).map(async (msg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();

          const senderRole = msg.sender_id === conversation.trader_id ? 'trader' : 'provider';

          return {
            ...msg,
            sender_name: profile?.full_name || 'Unknown',
            sender_role: senderRole
          };
        })
      );

      setMessages(messagesWithNames);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const toggleFlag = async () => {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          is_flagged: !selectedConversation.is_flagged,
          flag_reason: !selectedConversation.is_flagged ? flagReason : null,
          flagged_by_admin: !selectedConversation.is_flagged
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      toast.success(!selectedConversation.is_flagged ? 'Conversation flagged' : 'Flag removed');
      setSelectedConversation(null);
      fetchConversations();
    } catch (error: any) {
      console.error('Error updating flag:', error);
      toast.error('Failed to update flag');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Chat Monitoring</h1>
          <p className="text-muted-foreground mt-1">Monitor all trader-provider conversations</p>
        </div>

        <Card className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by trader, provider, booking..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chats</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="with_booking">With Booking</SelectItem>
                <SelectItem value="pre_booking">Pre-Booking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <Card key={convo.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">
                          {convo.trader_name} ↔ {convo.provider_name}
                        </h3>
                        {convo.is_flagged && (
                          <Badge variant="destructive" className="gap-1">
                            <Flag className="h-3 w-3" />
                            Flagged
                          </Badge>
                        )}
                        {convo.booking_number && (
                          <Badge variant="outline">
                            Booking: {convo.booking_number}
                          </Badge>
                        )}
                      </div>
                      
                      {convo.last_message_preview && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {convo.last_message_preview}
                        </p>
                      )}
                      
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Last activity: {format(new Date(convo.updated_at), 'MMM dd, yyyy HH:mm')}</span>
                        {convo.unread_trader_count + convo.unread_provider_count > 0 && (
                          <span className="text-orange-600">
                            {convo.unread_trader_count + convo.unread_provider_count} unread
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewConversation(convo)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Message Viewer Dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Conversation: {selectedConversation?.trader_name} ↔ {selectedConversation?.provider_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedConversation?.booking_number && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <strong>Booking:</strong> {selectedConversation.booking_number}
              </div>
            )}

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'trader' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.sender_role === 'trader'
                          ? 'bg-muted'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">
                          {msg.sender_name} ({msg.sender_role})
                        </span>
                        {!msg.read_at && (
                          <Badge variant="outline" className="text-xs">Unread</Badge>
                        )}
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                <h4 className="font-semibold">Moderation</h4>
              </div>
              
              <Textarea
                placeholder="Flag reason (required to flag conversation)"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={2}
              />

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setSelectedConversation(null)}
                >
                  Close
                </Button>
                <Button
                  variant={selectedConversation?.is_flagged ? "default" : "destructive"}
                  onClick={toggleFlag}
                  disabled={!selectedConversation?.is_flagged && !flagReason.trim()}
                  className="gap-2"
                >
                  <Flag className="h-4 w-4" />
                  {selectedConversation?.is_flagged ? 'Remove Flag' : 'Flag Conversation'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMessages;