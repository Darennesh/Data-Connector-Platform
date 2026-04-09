'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Connection, PaginatedResponse } from '@/lib/types';

export default function BrowserPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConn, setSelectedConn] = useState<number | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);

  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<PaginatedResponse<Connection>>('/connectors/')
      .then((r) => setConnections(r.data.results))
      .catch(() => {});
  }, []);

  const onSelectConnection = async (id: number) => {
    setSelectedConn(id);
    setSelectedTable(null);
    setColumns([]);
    setRows([]);
    setTotalRows(0);
    setOffset(0);
    setError('');
    setSubmitMsg('');
    setLoadingTables(true);
    try {
      const { data } = await api.get(`/connectors/${id}/tables/`);
      setTables(data.tables ?? []);
    } catch {
      setError('Failed to load tables');
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const onSelectTable = async (table: string, newOffset = 0) => {
    if (!selectedConn) return;
    setSelectedTable(table);
    setOffset(newOffset);
    setLoadingData(true);
    setError('');
    setSubmitMsg('');
    try {
      const [colRes, dataRes, countRes] = await Promise.all([
        api.get(`/connectors/${selectedConn}/tables/${table}/columns/`),
        api.get(`/connectors/${selectedConn}/tables/${table}/data/`, {
          params: { limit, offset: newOffset },
        }),
        api.get(`/connectors/${selectedConn}/tables/${table}/count/`),
      ]);
      setColumns(colRes.data.columns ?? []);
      setRows(dataRes.data.rows ?? []);
      setTotalRows(countRes.data.count ?? 0);
    } catch {
      setError('Failed to load table data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedConn || !selectedTable) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      await api.post('/submissions/fetch-and-submit/', {
        connection_id: selectedConn,
        table_name: selectedTable,
        limit: 1000,
        offset: 0,
        export_format: 'json',
      });
      setSubmitMsg('Data submitted successfully! Check the Submissions page.');
    } catch {
      setSubmitMsg('Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalRows / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Browser</h1>

      {/* Connection selector */}
      <div className="flex items-center gap-4">
        <label className="font-medium text-gray-700">Connection:</label>
        <select
          className="border rounded-lg px-3 py-2 bg-white text-gray-900 min-w-[250px]"
          value={selectedConn ?? ''}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v) onSelectConnection(v);
          }}
        >
          <option value="">— select a connection —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.db_type})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Tables sidebar */}
        {selectedConn && (
          <div className="w-60 shrink-0">
            <h2 className="font-semibold text-gray-700 mb-2">Tables</h2>
            {loadingTables ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : tables.length === 0 ? (
              <p className="text-sm text-gray-500">No tables found</p>
            ) : (
              <ul className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
                {tables.map((t) => (
                  <li key={t}>
                    <button
                      onClick={() => onSelectTable(t)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                        selectedTable === t
                          ? 'bg-blue-100 font-semibold text-blue-800'
                          : 'text-gray-700'
                      }`}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Data area */}
        {selectedTable && (
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 text-lg">
                  {selectedTable}
                </h2>
                <p className="text-sm text-gray-500">
                  {totalRows.toLocaleString()} rows &middot;{' '}
                  {columns.length} columns
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {submitting ? 'Submitting…' : 'Extract & Submit'}
              </button>
            </div>

            {submitMsg && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  submitMsg.includes('success')
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {submitMsg}
              </div>
            )}

            {/* Columns overview */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                Column details
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {columns.map((c) => (
                  <div
                    key={c.name}
                    className="bg-gray-50 rounded px-2 py-1 border text-xs"
                  >
                    <span className="font-medium text-gray-800">{c.name}</span>{' '}
                    <span className="text-gray-500">{c.type}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Data table */}
            {loadingData ? (
              <p className="text-gray-500">Loading data…</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-500">No data</p>
            ) : (
              <div className="overflow-auto border rounded-lg max-h-[55vh]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c.name}
                          className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                        >
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map((c) => (
                          <td
                            key={c.name}
                            className="px-3 py-1.5 whitespace-nowrap text-gray-700 max-w-[300px] truncate"
                          >
                            {row[c.name] === null
                              ? '—'
                              : typeof row[c.name] === 'object'
                                ? JSON.stringify(row[c.name])
                                : String(row[c.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <button
                  disabled={offset === 0}
                  onClick={() => onSelectTable(selectedTable, offset - limit)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <span className="text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={offset + limit >= totalRows}
                  onClick={() => onSelectTable(selectedTable, offset + limit)}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
