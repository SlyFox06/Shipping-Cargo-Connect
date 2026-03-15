import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProviderLayout from "@/components/layout/ProviderLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import { toast } from "sonner";
import { AddContainerModal } from "@/components/provider/AddContainerModal";
import { ViewContainerModal } from "@/components/provider/ViewContainerModal";
import { EditContainerModal } from "@/components/provider/EditContainerModal";
import { ContainerUtilizationChart } from "@/components/provider/ContainerUtilizationChart";
import { ContainerCard } from "@/components/provider/ContainerCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Containers = () => {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerId, setProviderId] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { role } = await getUserRole(session.user.id);
      if (role !== 'provider') {
        navigate('/dashboard');
        return;
      }

      // Get provider ID and verification status
      const { data: provider } = await supabase
        .from("providers")
        .select("id, verified")
        .eq("user_id", session.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        setIsVerified(provider.verified || false);
        fetchContainers(provider.id);

        // Set up realtime subscriptions
        const providerChannel = supabase
          .channel('provider-status')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'providers',
              filter: `id=eq.${provider.id}`
            },
            (payload: any) => {
              if (payload.new.verified) {
                setIsVerified(true);
                toast.success("Your provider account has been approved! You can now add containers.");
              }
            }
          )
          .subscribe();

        const containerChannel = supabase
          .channel('provider-containers')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'containers',
              filter: `provider_id=eq.${provider.id}`
            },
            () => fetchContainers(provider.id)
          )
          .subscribe();

        return () => {
          supabase.removeChannel(providerChannel);
          supabase.removeChannel(containerChannel);
        };
      }
    };
    checkAuthAndFetch();
  }, [navigate]);

  const fetchContainers = async (provId: string) => {
    try {
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .eq("provider_id", provId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContainers(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch containers");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (container: any) => {
    setSelectedContainer(container);
    setShowViewModal(true);
  };

  const handleEdit = (container: any) => {
    if (!isVerified) {
      toast.error("Your provider account must be verified to edit containers");
      return;
    }
    setSelectedContainer(container);
    setShowEditModal(true);
  };

  const handleDeleteClick = (container: any) => {
    setSelectedContainer(container);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedContainer) return;

    try {
      // Check for active bookings first
      const { data: activeBookings, error: bookingError } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("container_id", selectedContainer.id)
        .in("status", ["confirmed", "in_transit"]);

      if (bookingError) throw bookingError;

      if (activeBookings && activeBookings.length > 0) {
        toast.error(
          `Cannot delete container with ${activeBookings.length} active booking(s). Please complete or cancel them first.`
        );
        return;
      }

      const { error } = await supabase
        .from("containers")
        .delete()
        .eq("id", selectedContainer.id);

      if (error) throw error;

      // Log activity
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          user_id: session.user.id,
          action: "delete_container",
          table_name: "containers",
          record_id: selectedContainer.id,
          details: {
            container_id: selectedContainer.id,
            container_type: selectedContainer.container_type,
            origin: selectedContainer.origin,
            destination: selectedContainer.destination
          }
        });
      }

      toast.success("Container deleted successfully");
      fetchContainers(providerId);
      setShowDeleteDialog(false);
      setSelectedContainer(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete container");
    }
  };

  // Filter containers based on search
  const filteredContainers = containers.filter((container) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      container.container_type?.toLowerCase().includes(searchLower) ||
      container.origin?.toLowerCase().includes(searchLower) ||
      container.destination?.toLowerCase().includes(searchLower) ||
      container.origin_city?.toLowerCase().includes(searchLower) ||
      container.origin_country?.toLowerCase().includes(searchLower) ||
      container.destination_city?.toLowerCase().includes(searchLower) ||
      container.destination_country?.toLowerCase().includes(searchLower) ||
      container.transport_mode?.toLowerCase().includes(searchLower) ||
      container.status?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <ProviderLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">My Containers</h1>
            <p className="text-muted-foreground mt-1">Add and manage your container listings</p>
          </div>
          <Button 
            onClick={() => {
              if (!isVerified) {
                toast.error("Your provider account is under review. You can add containers once approved by the admin.");
                return;
              }
              setShowAddModal(true);
            }}
            disabled={!isVerified}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Container
          </Button>
        </div>

        {!loading && containers.length > 0 && (
          <>
            <ContainerUtilizationChart containers={containers} />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by type, route, city, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </>
        )}

        {loading ? (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-muted-foreground">Loading containers...</p>
          </Card>
        ) : containers.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No containers added yet</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Add your first container to start receiving bookings
            </p>
            <Button onClick={() => setShowAddModal(true)} disabled={!isVerified}>
              <Plus className="mr-2 h-4 w-4" />
              Add Container
            </Button>
          </Card>
        ) : filteredContainers.length === 0 ? (
          <Card className="p-12 text-center">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No containers found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your search criteria
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContainers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </div>

      <AddContainerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchContainers(providerId)}
        providerId={providerId}
        isProviderVerified={isVerified}
      />

      <ViewContainerModal
        open={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedContainer(null);
        }}
        container={selectedContainer}
      />

      <EditContainerModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedContainer(null);
        }}
        onSuccess={() => fetchContainers(providerId)}
        container={selectedContainer}
        isProviderVerified={isVerified}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the container
              and remove it from all listings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedContainer(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProviderLayout>
  );
};

export default Containers;
