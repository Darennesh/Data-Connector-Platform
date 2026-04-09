'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User, AuditLog, PaginatedResponse } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Audit log filters
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get<PaginatedResponse<User>>(
        '/accounts/admin/users/',
      );
      setUsers(data.results);
    } catch {
      // ignore
    }
  };

  const fetchLogs = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterAction) params.action = filterAction;
      if (filterUser) params.user = filterUser;
      const { data } = await api.get<PaginatedResponse<AuditLog>>(
        '/accounts/audit-logs/',
        { params },
      );
      setLogs(data.results);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchLogs()]).finally(() =>
      setLoading(false),
    );
  }, []);

  useEffect(() => {
    if (tab === 'audit') fetchLogs();
  }, [filterAction, filterUser]);

  const setRole = async (userId: number, role: 'admin' | 'user') => {
    setActionMsg('');
    try {
      await api.post(`/accounts/admin/users/${userId}/set-role/`, {
        role,
      });
      setActionMsg(`Role updated`);
      fetchUsers();
    } catch {
      setActionMsg('Failed to update role');
    }
  };

  const toggleActive = async (userId: number) => {
    setActionMsg('');
    try {
      await api.post(`/accounts/admin/users/${userId}/toggle-active/`);
      setActionMsg('Status toggled');
      fetchUsers();
    } catch {
      setActionMsg('Failed to toggle status');
    }
  };

  if (!user || user.role !== 'admin') {
    return <p className="text-gray-500">Access denied</p>;
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['users', 'audit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'users' ? 'User Management' : 'Audit Logs'}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
          {actionMsg}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Active</th>
                <th className="px-4 py-2 text-left font-medium">Joined</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{u.id}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {u.username}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        u.role === 'admin'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {u.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(u.date_joined).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {u.id !== user.id && (
                        <>
                          <button
                            onClick={() =>
                              setRole(
                                u.id,
                                u.role === 'admin' ? 'user' : 'admin',
                              )
                            }
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {u.role === 'admin'
                              ? 'Demote'
                              : 'Promote'}
                          </button>
                          <button
                            onClick={() => toggleActive(u.id)}
                            className="text-xs text-yellow-600 hover:underline"
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit logs tab */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Filter by action…"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-48"
            />
            <input
              type="text"
              placeholder="Filter by user ID…"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-48"
            />
            <button
              onClick={fetchLogs}
              className="bg-gray-200 px-3 py-1.5 rounded text-sm hover:bg-gray-300"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-auto border rounded-lg max-h-[60vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Detail</th>
                  <th className="px-3 py-2 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {log.username ?? `#${log.user}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate">
                      {JSON.stringify(log.detail)}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-gray-400"
                    >
                      No audit logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
