import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Shield, UserPlus, Key, Trash2, MoreHorizontal, Loader2, Mail, Phone, Pencil, Plus, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/use-auth";
import {
  createAdminUser,
  updateAdminUser,
  updateAdminUserPassword,
  updateAdminUserRole,
} from "@/lib/user-management.functions";
import { deleteAuthUser, listStaffUsers, type StaffUser } from "@/lib/admin-users.functions";
import { getRoles, getPermissions, saveRole, deleteRole } from "@/lib/roles-permissions.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffAndRolesPage,
});

function StaffAndRolesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-foreground">Staff &amp; Permissions</h1>
      <Tabs defaultValue="staff" className="w-full">
        <TabsList>
          <TabsTrigger value="staff">Staff Management</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="pt-4">
          <StaffPage />
        </TabsContent>
        <TabsContent value="roles" className="pt-4">
          <RolesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- STAFF PAGE CONTENT ---
function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ email: "", fullName: "", phone: "", role: "", password: "" });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "", fullName: "", role: "" });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createUserMutation = useServerFn(createAdminUser);
  const passwordMutation = useServerFn(updateAdminUserPassword);
  const roleMutation = useServerFn(updateAdminUserRole);
  const deleteUserMutation = useServerFn(deleteAuthUser);
  const editUserMutation = useServerFn(updateAdminUser);

  const { user: currentUser, roles: currentRoles } = useAuth();
  const isSuperAdmin = currentRoles.includes("super_admin");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [staff, rolesData] = await Promise.all([listStaffUsers(), getRoles()]);
      setUsers(staff);
      setCustomRoles((rolesData ?? []).filter((r: any) => !r.is_system));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Super admin accounts are only ever visible to a super admin.
  const visibleUsers = users.filter((u) => isSuperAdmin || u.id === currentUser?.id);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role) return toast.error("Please select a role");
    setIsSubmitting(true);
    try {
      await createUserMutation({ data: formData });
      toast.success("User created successfully");
      setIsAddModalOpen(false);
      setFormData({ email: "", password: "", fullName: "", role: "" });
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (user: StaffUser) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email ?? "",
      fullName: user.full_name ?? "",
      phone: user.phone ?? "",
      role: user.custom_role_id ?? "",
      password: "",
    });
    setShowEditPassword(false);
    setIsEditModalOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await editUserMutation({
        data: {
          userId: selectedUser.id,
          email: editForm.email,
          fullName: editForm.fullName,
          phone: editForm.phone,
          // Super admin accounts keep their system role untouched.
          role: selectedUser.role === "super_admin" ? "" : editForm.role,
          password: editForm.password,
        },
      });
      toast.success("User updated");
      setIsEditModalOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await passwordMutation({ data: { userId: selectedUser.id, password: newPassword } });
      toast.success("Password updated");
      setIsPassModalOpen(false);
      setNewPassword("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newRole) return;
    setIsSubmitting(true);
    try {
      await roleMutation({ data: { userId: selectedUser.id, role: newRole } });
      toast.success("Role updated");
      setIsRoleModalOpen(false);
      setNewRole("");
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteUserMutation({ data: { userId: selectedUser.id } });
      toast.success("User deleted");
      setIsDeleteModalOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete user");
    }
  };

  return (
    <div className="space-y-6">
      {isSuperAdmin && (
        <div className="flex items-center justify-end gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <UserPlus className="h-4 w-4" /> Add New User
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          visibleUsers.map((user) => (
            <div key={user.id} className="surface-card p-5 group relative overflow-hidden transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {user.full_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{user.full_name || "Unnamed"}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email || "No email"}
                    </div>
                    {user.phone ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {user.phone}
                      </div>
                    ) : null}
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      {user.role === "super_admin" ? "Super Admin" : user.custom_role_name || "No role assigned"}
                    </div>
                  </div>
                </div>
                {isSuperAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1 hover:bg-muted rounded-md">
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(user)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit user
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedUser(user);
                          setNewPassword("");
                          setIsPassModalOpen(true);
                        }}
                      >
                        <Key className="mr-2 h-4 w-4" /> Change Password
                      </DropdownMenuItem>
                      {user.role !== "super_admin" && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.custom_role_id ?? "");
                            setIsRoleModalOpen(true);
                          }}
                        >
                          <Shield className="mr-2 h-4 w-4" /> Change Role
                        </DropdownMenuItem>
                      )}
                      {user.id !== currentUser?.id && user.role !== "super_admin" && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))
        )}
        {!loading && visibleUsers.length === 0 && (
          <div className="col-span-full py-12 text-center surface-card border-dashed">
            <UserPlus className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">No staff users yet.</p>
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <form onSubmit={handleAddUser}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a staff member. They can log in with these credentials right away.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showAddPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={showAddPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {customRoles.length > 0 ? (
                      customRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-center text-muted-foreground">
                        No roles created yet. Create one in the Roles tab first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create User
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <form onSubmit={handleEditUser}>
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>
                Update the account details. Leave the password field empty to keep the current password.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto modal-scroll py-4 pr-1">
              <div className="grid gap-2">
                <Label htmlFor="editFullName">Full name</Label>
                <Input
                  id="editFullName"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  maxLength={120}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  maxLength={30}
                />
              </div>
              {selectedUser?.role !== "super_admin" && (
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {customRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="editPassword">New password (optional)</Label>
                <div className="relative">
                  <Input
                    id="editPassword"
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave empty to keep current"
                    className="pr-10"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save changes
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPassModalOpen} onOpenChange={setIsPassModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[400px]">
          <form onSubmit={handlePassword}>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>{selectedUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Update Password
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[400px]">
          <form onSubmit={handleRoleChange}>
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
              <DialogDescription>{selectedUser?.email}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {customRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <button type="submit" disabled={isSubmitting} className="btn-brand w-full py-2.5 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Save Role
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete this user?"
        description={`${selectedUser?.full_name || selectedUser?.email || "This user"} will lose access immediately. This cannot be undone.`}
        confirmText="Delete user"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// --- ROLES PAGE CONTENT ---
function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", permissionIds: [] as string[] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const saveRoleMutation = useServerFn(saveRole);
  const deleteRoleMutation = useServerFn(deleteRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(rolesData ?? []);
      setPermissions(permsData ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: "", description: "", permissionIds: [] });
    setIsModalOpen(true);
  };

  const openEdit = (role: any) => {
    setEditingId(role.id);
    setFormData({
      name: role.name ?? "",
      description: role.description ?? "",
      permissionIds: (role.role_permissions ?? []).map((rp: any) => rp.permission_id),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Role name is required");

    setIsSubmitting(true);
    try {
      await saveRoleMutation({ data: editingId ? { ...formData, id: editingId } : formData });
      toast.success("Role saved successfully");
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: "", description: "", permissionIds: [] });
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((pid) => pid !== id)
        : [...prev.permissionIds, id],
    }));
  };

  const customRoles = roles.filter((role) => !role.is_system);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> Create Role
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          customRoles.map((role) => (
            <div key={role.id} className="surface-card p-5 group relative">
              <div className="flex items-start justify-between">
                <button type="button" onClick={() => openEdit(role)} className="flex items-center gap-2 text-left">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{role.name}</h3>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(role)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{role.description}</p>
              <div className="mt-4 flex flex-wrap gap-1">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {(role.role_permissions ?? []).length} Permissions
                </span>
              </div>
            </div>
          ))
        )}
        {!loading && customRoles.length === 0 && (
          <div className="col-span-full py-12 text-center surface-card border-dashed">
            <Shield className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">No custom roles created yet.</p>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl">
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-xl font-bold">{editingId ? "Edit Role" : "Create Custom Role"}</DialogTitle>
              <DialogDescription>Define a role and its associated permissions.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scrollbar-thin">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="roleName" className="font-semibold">
                    Role Name
                  </Label>
                  <Input
                    id="roleName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Content Manager"
                    className="bg-muted/50"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description" className="font-semibold">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What can this role do?"
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-base font-bold">Permissions</Label>
                  <span className="text-xs text-muted-foreground">{formData.permissionIds.length} selected</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {permissions.map((perm) => {
                    const active = formData.permissionIds.includes(perm.id);
                    return (
                      <button
                        type="button"
                        key={perm.id}
                        aria-pressed={active}
                        onClick={() => togglePermission(perm.id)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                          active ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                            active ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                        <span className="grid gap-1 leading-none">
                          <span className="text-sm font-semibold leading-none">{perm.name}</span>
                          {perm.description && (
                            <span className="block text-[11px] text-muted-foreground leading-tight mt-1">{perm.description}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 pt-2 border-t bg-muted/20">
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] btn-brand py-2.5 flex items-center justify-center gap-2 rounded-lg shadow-sm">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Save Role
                </button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this role?"
        description={`Users assigned to "${deleteTarget?.name ?? ""}" will lose their permissions.`}
        confirmText="Delete role"
        variant="danger"
        onConfirm={async () => {
          try {
            await deleteRoleMutation({ data: { id: deleteTarget.id } });
            toast.success("Role deleted");
            setDeleteTarget(null);
            loadData();
          } catch (e: any) {
            toast.error(e?.message || "Failed to delete role");
          }
        }}
      />
    </div>
  );
}
