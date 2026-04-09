'use client';

import { useEffect, useState, FormEvent } from 'react';
import api from '@/lib/api';
import { Connection, PaginatedResponse } from '@/lib/types';

const DB_TYPES = ['postgresql', 'mysql', 'mongodb', 'clickhouse'] as const;
const DB_DEFAULTS: Record<string, { port: number }> = {
  postgresql: { port: 5432 },
  mysql: { port: 3306 },
  mongodb: { port: 27017 },
  clickhouse: { port: 9000 },
};

interface TestResult {
  id: number;
  ok: boolean;
  message: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [testing, setTesting] = useState<Record<number, boolean>>({});

  // Form state
  const [name, setName] = useState('');
  const [dbType, setDbType] = useState<string>('postgresql');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get<PaginatedResponse<Connection>>('/connectors/');
      setConnections(data.results);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const resetForm = () => {
    setName('');
    setDbType('postgresql');
    setHost('');
    setPort(5432);
    setDatabase('');
    setUsername('');
    setPassword('');
    setFormError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/connectors/', { name, db_type: dbType, host, port, database, username, password });
      setShowForm(false);
      resetForm();
      await fetchConnections();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      setFormError(data ? Object.values(data).flat().join('. ') : 'Failed to create connection');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: number) => {
    setTesting((p) => ({ ...p, [id]: true }));
    try {
      const { data } = await api.post(`/connectors/${id}/test/`);
      setTestResults((p) => ({ ...p, [id]: { id, ...data } }));
    } catch {
      setTestResults((p) => ({ ...p, [id]: { id, ok: false, message: 'Test failed' } }));
    } finally {
      setTesting((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this connection?')) return;
    try {
      await api.delete(`/connectors/${id}/`);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // handled
    }
  };

  const dbBadge = (type: string) => {
    const colors: Record<string, string> = {
      postgresql: 'bg-blue-100 text-blue-700',
      mysql: 'bg-orange-100 text-orange-700',
      mongodb: 'bg-green-100 text-green-700',
      clickhouse: 'bg-yellow-100 text-yellow-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return <div className="animate-pulse text-gray-400">Loading connections…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Connections</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ New Connection'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">New Connection</h3>
          {formError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{formError}</div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Database Type</label>
              <select
                value={dbType}
                onChange={(e) => {
                  setDbType(e.target.value);
                  setPort(DB_DEFAULTS[e.target.value]?.port || 5432);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {DB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Host</label>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Database</label>
              <input
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Creating…' : 'Create Connection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connections list */}
      {connections.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          No connections yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="bg-white rounded-xl shadow p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{conn.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${dbBadge(conn.db_type)}`}
                    >
                      {conn.db_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {conn.host}:{conn.port} / {conn.database}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {testResults[conn.id] && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      testResults[conn.id].ok
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {testResults[conn.id].ok ? '✓ Connected' : '✗ Failed'}
                  </span>
                )}
                <button
                  onClick={() => handleTest(conn.id)}
                  disabled={testing[conn.id]}
                  className="text-sm px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {testing[conn.id] ? 'Testing…' : 'Test'}
                </button>
                <button
                  onClick={() => handleDelete(conn.id)}
                  className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
