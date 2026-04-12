"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Connection, PaginatedResponse } from "@/lib/types";

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
  const [submitMsg, setSubmitMsg] = useState("");
  const [error, setError] = useState("");

  // Editable grid state
  const [editMode, setEditMode] = useState(false);
  const [editedRows, setEditedRows] = useState<Record<string, unknown>[]>([]);
  const [dirtySet, setDirtySet] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string;
  } | null>(null);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<PaginatedResponse<Connection>>("/connectors/")
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
    setError("");
    setSubmitMsg("");
    setLoadingTables(true);
    try {
      const { data } = await api.get(`/connectors/${id}/tables/`);
      setTables(data.tables ?? []);
    } catch {
      setError("Failed to load tables");
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
    setError("");
    setSubmitMsg("");
    setEditMode(false);
    setEditedRows([]);
    setDirtySet(new Set());
    setDeletedIndices(new Set());
    setEditingCell(null);
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
      setError("Failed to load table data");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedConn || !selectedTable) return;
    setSubmitting(true);
    setSubmitMsg("");
    try {
      await api.post("/submissions/fetch-and-submit/", {
        connection_id: selectedConn,
        table_name: selectedTable,
        limit: 1000,
        offset: 0,
        export_format: "json",
      });
      setSubmitMsg("Data submitted successfully! Check the Submissions page.");
    } catch {
      setSubmitMsg("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Editable grid helpers ---

  const enterEditMode = () => {
    setEditedRows(rows.map((r) => ({ ...r })));
    setDirtySet(new Set());
    setDeletedIndices(new Set());
    setEditMode(true);
    setSubmitMsg("");
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditedRows([]);
    setDirtySet(new Set());
    setDeletedIndices(new Set());
    setEditingCell(null);
  };

  const updateCell = useCallback(
    (rowIdx: number, colName: string, value: string) => {
      setEditedRows((prev) => {
        const copy = [...prev];
        copy[rowIdx] = { ...copy[rowIdx], [colName]: value };
        return copy;
      });
      setDirtySet((prev) => new Set(prev).add(rowIdx));
    },
    [],
  );

  const addRow = () => {
    const blank: Record<string, unknown> = {};
    columns.forEach((c) => (blank[c.name] = ""));
    setEditedRows((prev) => [...prev, blank]);
    setDirtySet((prev) => new Set(prev).add(editedRows.length));
  };

  const deleteRow = (idx: number) => {
    setDeletedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleSubmitEdited = async () => {
    if (!selectedConn || !selectedTable) return;
    const finalRows = editedRows.filter((_, i) => !deletedIndices.has(i));
    if (finalRows.length === 0) {
      setSubmitMsg("No rows to submit.");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      await api.post("/submissions/extract/", {
        connection_id: selectedConn,
        table_name: selectedTable,
        data: finalRows,
        export_formats: ["json"],
      });
      setSubmitMsg(
        `Submitted ${finalRows.length} edited rows! Check the Submissions page.`,
      );
      exitEditMode();
    } catch {
      setSubmitMsg("Submission of edited data failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const changedCount = dirtySet.size;
  const deletedCount = deletedIndices.size;

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
          value={selectedConn ?? ""}
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
                          ? "bg-blue-100 font-semibold text-blue-800"
                          : "text-gray-700"
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-gray-800 text-lg">
                  {selectedTable}
                </h2>
                <p className="text-sm text-gray-500">
                  {totalRows.toLocaleString()} rows &middot; {columns.length}{" "}
                  columns
                  {editMode && (
                    <span className="ml-2 text-blue-600">
                      (Edit Mode — {changedCount} changed, {deletedCount}{" "}
                      deleted)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <>
                    <button
                      onClick={enterEditMode}
                      disabled={rows.length === 0}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      Edit Data
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      {submitting ? "Submitting…" : "Extract & Submit"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={addRow}
                      className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm"
                    >
                      + Add Row
                    </button>
                    <button
                      onClick={handleSubmitEdited}
                      disabled={submitting}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                    >
                      {submitting ? "Submitting…" : "Submit Edited Data"}
                    </button>
                    <button
                      onClick={exitEditMode}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {submitMsg && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  submitMsg.includes("success")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
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
                    <span className="font-medium text-gray-800">{c.name}</span>{" "}
                    <span className="text-gray-500">{c.type}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Data table */}
            {loadingData ? (
              <p className="text-gray-500">Loading data…</p>
            ) : (editMode ? editedRows : rows).length === 0 ? (
              <p className="text-gray-500">No data</p>
            ) : (
              <div className="overflow-auto border rounded-lg max-h-[55vh]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {editMode && (
                        <th className="px-2 py-2 text-center font-medium text-gray-700 w-10">
                          #
                        </th>
                      )}
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
                    {(editMode ? editedRows : rows).map((row, i) => (
                      <tr
                        key={i}
                        className={
                          editMode
                            ? deletedIndices.has(i)
                              ? "bg-red-50 line-through opacity-50"
                              : dirtySet.has(i)
                                ? "bg-yellow-50"
                                : "hover:bg-gray-50"
                            : "hover:bg-gray-50"
                        }
                      >
                        {editMode && (
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => deleteRow(i)}
                              title={
                                deletedIndices.has(i)
                                  ? "Restore row"
                                  : "Delete row"
                              }
                              className={`text-xs font-bold w-6 h-6 rounded ${
                                deletedIndices.has(i)
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-red-100 text-red-600 hover:bg-red-200"
                              }`}
                            >
                              {deletedIndices.has(i) ? "↩" : "✕"}
                            </button>
                          </td>
                        )}
                        {columns.map((c) => (
                          <td
                            key={c.name}
                            className={`px-3 py-1.5 whitespace-nowrap max-w-[300px] ${
                              editMode && !deletedIndices.has(i)
                                ? "cursor-text"
                                : "text-gray-700 truncate"
                            }`}
                            onClick={() => {
                              if (editMode && !deletedIndices.has(i)) {
                                setEditingCell({ row: i, col: c.name });
                                setTimeout(() => inputRef.current?.focus(), 0);
                              }
                            }}
                          >
                            {editMode &&
                            !deletedIndices.has(i) &&
                            editingCell?.row === i &&
                            editingCell?.col === c.name ? (
                              <input
                                ref={inputRef}
                                className="w-full border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                value={String(row[c.name] ?? "")}
                                onChange={(e) =>
                                  updateCell(i, c.name, e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape" || e.key === "Enter")
                                    setEditingCell(null);
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    const colIdx = columns.findIndex(
                                      (col) => col.name === c.name,
                                    );
                                    const nextCol =
                                      columns[(colIdx + 1) % columns.length];
                                    setEditingCell({
                                      row:
                                        colIdx + 1 >= columns.length
                                          ? i + 1
                                          : i,
                                      col: nextCol.name,
                                    });
                                    setTimeout(
                                      () => inputRef.current?.focus(),
                                      0,
                                    );
                                  }
                                }}
                              />
                            ) : row[c.name] === null ? (
                              <span className="text-gray-400 italic">NULL</span>
                            ) : typeof row[c.name] === "object" ? (
                              JSON.stringify(row[c.name])
                            ) : (
                              String(row[c.name])
                            )}
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
