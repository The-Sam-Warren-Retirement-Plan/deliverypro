import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import DriverView from "./DriverView";

export default function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === "admin") return <AdminDashboard />;
  if (role === "driver") return <DriverView />;

  // No role assigned yet
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">Your account doesn't have a role assigned yet. Please contact an admin.</p>
      </div>
    </div>
  );
}
