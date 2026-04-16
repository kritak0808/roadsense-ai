"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { api, User } from "@/lib/api";
import { useAuth, hasRole } from "@/lib/auth";
import toast from "react-hot-toast";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (user && !hasRole(user, "admin")) { router.push("/"); return; }
    if (!user) return;
    api.admin.users().then(({ data }) => setUsers(data.data)).catch(() => {});
    api.admin.metrics().then(({ data }) => setMetrics(data.data)).catch(() => {});
  }, [user]);

  const toggleActive = async (u: User) => {
    try {
      await api.admin.updateUser(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
      toast.success("User updated");
    } catch { toast.error("Update failed"); }
  };

  const changeRole = async (u: User, role: string) => {
    try {
      await api.admin.updateUser(u.id, { role: role as User["role"] });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: role as User["role"] } : x));
      toast.success("Role updated");
    } catch { toast.error("Update failed"); }
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.username}?`)) return;
    try {
      await api.admin.deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("User deleted");
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>

        {/* System metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Predictions", value: metrics.total_predictions as number },
              { label: "Total Users", value: metrics.total_users as number },
              { label: "Total Jobs", value: metrics.total_jobs as number },
              { label: "Running Jobs", value: metrics.running_jobs as number },
            ].map((m) => (
              <div key={m.label} className="card text-center">
                <div className="text-2xl font-bold text-white">{m.value}</div>
                <div className="text-gray-400 text-xs mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* User management */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">User Management</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Username</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Role</th>
                  <th className="text-left py-2 pr-4">Active</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 text-white">{u.username}</td>
                    <td className="py-2 pr-4 text-gray-400">{u.email}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-2">
                      <button onClick={() => deleteUser(u)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
