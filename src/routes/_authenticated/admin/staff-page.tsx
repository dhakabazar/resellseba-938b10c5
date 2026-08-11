import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StaffPage from "./staff";
import RolesPage from "./roles";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffTabsPage,
});

function StaffTabsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-foreground">Staff & Permissions</h1>
      <Tabs defaultValue="staff" className="w-full">
        <TabsList>
          <TabsTrigger value="staff">Staff Management</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
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
