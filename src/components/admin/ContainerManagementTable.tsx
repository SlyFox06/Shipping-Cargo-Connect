import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Search, CheckCircle, XCircle, Trash2, Download, Eye, Edit } from "lucide-react";
import { ViewContainerModal } from "@/components/provider/ViewContainerModal";
import { EditContainerModal } from "@/components/provider/EditContainerModal";
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

type Container = {
  id: string;
  origin: string;
  destination: string;
  capacity_kg: number;
  price_usd: number;
  container_type: string;
  transport_mode: string;
  status: string;
  available_from: string;
  available_until: string;
  provider_id: string;
  providers?: {
    user_id: string;
    profiles?: {
      company_name: string | null;
    };
  };
};

export const ContainerManagementTable = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const itemsPerPage = 10;

  const fetchContainers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch provider details separately
      const containersWithProviders = await Promise.all(
        (data || []).map(async (container) => {
          const { data: providerData } = await supabase
            .from("providers")
            .select("user_id")
            .eq("id", container.provider_id)
            .single();

          if (providerData) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("company_name")
              .eq("id", providerData.user_id)
              .single();

            return {
              ...container,
              providers: {
                user_id: providerData.user_id,
                profiles: profileData || undefined,
              },
            };
          }

          return {
            ...container,
            providers: undefined,
          };
        })
      );

      setContainers(containersWithProviders);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();

    // Real-time subscription
    const channel = supabase
      .channel('container-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => {
        fetchContainers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (containerId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("containers")
        .update({ status })
        .eq("id", containerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Container ${status} successfully`,
      });

      fetchContainers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveContainer = async (containerId: string) => {
    try {
      const { error } = await supabase
        .from("containers")
        .update({ status: "available" })
        .eq("id", containerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Container approved successfully",
      });

      fetchContainers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectContainer = async (containerId: string) => {
    try {
      const { error } = await supabase
        .from("containers")
        .update({ status: "rejected" })
        .eq("id", containerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Container rejected",
      });

      fetchContainers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (container: any) => {
    setSelectedContainer(container);
    setShowViewModal(true);
  };

  const handleEdit = (container: any) => {
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
      const { error } = await supabase
        .from("containers")
        .delete()
        .eq("id", selectedContainer.id);

      if (error) throw error;

      // Log admin activity
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          user_id: session.user.id,
          action: "admin_delete_container",
          table_name: "containers",
          record_id: selectedContainer.id,
          details: {
            container_id: selectedContainer.id,
            provider_id: selectedContainer.provider_id,
            container_type: selectedContainer.container_type
          }
        });
      }

      toast({
        title: "Success",
        description: "Container deleted successfully",
      });

      fetchContainers();
      setShowDeleteDialog(false);
      setSelectedContainer(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ["Provider", "Origin", "Destination", "Type", "Mode", "Capacity (kg)", "Price (USD)", "Status"],
      ...filteredContainers.map((c) => [
        c.providers?.profiles?.company_name || "N/A",
        c.origin,
        c.destination,
        c.container_type,
        c.transport_mode,
        c.capacity_kg.toString(),
        c.price_usd.toString(),
        c.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `containers-${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredContainers = containers.filter((container) => {
    const matchesSearch =
      container.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      container.providers?.profiles?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || container.status === statusFilter;
    const matchesMode = modeFilter === "all" || container.transport_mode === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  const totalPages = Math.ceil(filteredContainers.length / itemsPerPage);
  const paginatedContainers = filteredContainers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search containers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="sea">Sea</SelectItem>
            <SelectItem value="air">Air</SelectItem>
            <SelectItem value="land">Land</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Capacity (kg)</TableHead>
              <TableHead>Price (USD)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredContainers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No containers found
                </TableCell>
              </TableRow>
            ) : (
              paginatedContainers.map((container) => (
                <TableRow key={container.id}>
                  <TableCell>
                    {container.providers?.profiles?.company_name || "N/A"}
                  </TableCell>
                  <TableCell>{container.origin}</TableCell>
                  <TableCell>{container.destination}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{container.container_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{container.transport_mode}</Badge>
                  </TableCell>
                  <TableCell>{container.capacity_kg.toLocaleString()}</TableCell>
                  <TableCell>${container.price_usd.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        container.status === "available"
                          ? "default"
                          : container.status === "booked"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {container.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleView(container)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(container)}
                        title="Edit Container"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {container.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveContainer(container.id)}
                            title="Approve Container"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRejectContainer(container.id)}
                            title="Reject Container"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteClick(container)}
                        title="Delete Container"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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
        onSuccess={fetchContainers}
        container={selectedContainer}
        isProviderVerified={true}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Container</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this container? This action cannot be undone
              and will remove it from all dashboards and search results.
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
    </div>
  );
};
