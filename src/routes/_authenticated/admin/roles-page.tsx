import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Lock,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getRoles, getPermissions, saveRole, deleteRole } from "@/lib/roles-permissions.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";

export const Route = createFileRoute("/_authenticated/admin/roles-page")({
  component: RolesPage,
});

function RolesPage() {
  const getRolesFn = useServerFn(getRoles);
  const getPermsFn = useServerFn(getPermissions);
  const saveRoleFn = useServerFn(saveRole);
  const deleteRoleFn = useServerFn(deleteRole);

  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissionIds: [] as string[],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        getRolesFn(),
        getPermsFn(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err: any) {
      toast.error("Failed to load roles: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await saveRoleFn({ 
        data: { 
          id: selectedRole?.id,
          ...formData 
        } 
      });
      toast.success(selectedRole ? "Role updated" : "Role created");
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    try {
      setLoading(true);
      await deleteRoleFn({ data: { id: selectedRole.id } });
      toast.success("Role deleted");
      setIsDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setSelectedRole(null);
    setFormData({ name: "", description: "", permissionIds: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (role: any) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissionIds: role.role_permissions?.map((rp: any) => rp.permission_id) || [],
    });
    setIsModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter(id => id !== permId)
        : [...prev.permissionIds, permId]
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Define custom system roles and assign specific permissions to each."
        actions={
          <button
            onClick={openAddModal}
            className="btn-brand px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading && roles.length === 0 ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : roles.map(role => (
          <div key={role.id} className="surface-card p-5 flex flex-col justify-between group transition-all hover:shadow-md">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${role.is_system ? 'text-primary' : 'text-muted-foreground'}`} />
                  <h3 className="font-bold text-foreground">{role.name}</h3>
                </div>
                {role.is_system && (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {role.description || "No description provided."}
              </p>
              
              <div className="mt-4 flex flex-wrap gap-1.5">
                {role.role_permissions?.length > 0 ? (
                  role.role_permissions.slice(0, 3).map((rp: any) => {
                    const perm = permissions.find(p => p.id === rp.permission_id);
                    return perm ? (
                      <span key={rp.permission_id} className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium">
                        {perm.name}
                      </span>
                    ) : null;
                  })
                ) : (
                  <span className="text-xs text-muted-foreground italic">No permissions assigned</span>
                )}
                {role.role_permissions?.length > 3 && (
                  <span className="text-[10px] text-muted-foreground self-center">
                    +{role.role_permissions.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <button
                onClick={() => openEditModal(role)}
                className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              {!role.is_system && (
                <button
                  onClick={() => {
                    setSelectedRole(role);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-2 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedRole ? "Edit Role" : "Create New Role"}</DialogTitle>
            <DialogDescription>
              Define the role name and select the permissions that should be granted to this role.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Sales Manager"
                disabled={selectedRole?.is_system}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Briefly describe what this role does"
              />
            </div>

            <div className="space-y-3 mt-6">
              <Label className="text-base font-semibold">Permissions</Label>
              <div className="grid grid-cols-1 gap-3 border rounded-lg p-4">
                {permissions.map(perm => (
                  <div key={perm.id} className="flex items-start space-x-3">
                    <Checkbox 
                      id={`perm-${perm.id}`}
                      checked={formData.permissionIds.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={`perm-${perm.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {perm.name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {perm.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>

          <DialogFooter className="pt-4 border-t mt-auto">
            <button
              type="button"
              className="btn-outline px-4 py-2"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRole}
              disabled={loading}
              className="btn-brand px-6 py-2 flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedRole ? "Update Role" : "Create Role"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteRole}
        isLoading={loading}
        title="Delete Custom Role"
        description={`Are you sure you want to delete the "${selectedRole?.name}" role? This will remove the role from all assigned users.`}
        confirmText="Delete Role"
        variant="danger"
      />
    </div>
  );
}
