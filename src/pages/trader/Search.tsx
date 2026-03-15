import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TraderLayout from "@/components/layout/TraderLayout";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { SearchContainers } from "@/components/trader/SearchContainers";
import { EnhancedBookingModal } from "@/components/trader/EnhancedBookingModal";
import { PreBookingChatModal } from "@/components/chat/PreBookingChatModal";

const Search = () => {
  const navigate = useNavigate();
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [traderId, setTraderId] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'trader') {
        navigate('/dashboard');
        return;
      }
      setTraderId(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  const handleBookContainer = (container: any) => {
    setSelectedContainer(container);
    setShowBookingModal(true);
  };

  const handleAskQuestion = (container: any) => {
    setSelectedContainer(container);
    setShowChatModal(true);
  };

  return (
    <TraderLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Search Containers</h1>
          <p className="text-muted-foreground mt-1">Find and book available container space</p>
        </div>

        <SearchContainers 
          onBookContainer={handleBookContainer}
          onAskQuestion={handleAskQuestion}
        />
      </div>

      {selectedContainer && (
        <>
          <EnhancedBookingModal
            open={showBookingModal}
            onClose={() => {
              setShowBookingModal(false);
              setSelectedContainer(null);
            }}
            onSuccess={() => {
              navigate('/dashboard/trader/bookings');
            }}
            container={selectedContainer}
            traderId={traderId}
          />

          <PreBookingChatModal
            container={selectedContainer}
            open={showChatModal}
            onOpenChange={setShowChatModal}
            currentUserId={traderId}
          />
        </>
      )}
    </TraderLayout>
  );
};

export default Search;
