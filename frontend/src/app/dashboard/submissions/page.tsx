"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Submission,
  SubmissionFile,
  PaginatedResponse,
  FileShare,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [shares, setShares] = useState<Record<number, FileShare[]>>({});

  // share form
  const [shareFileId, setShareFileId] = useState<number | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  const fetchSubmissions = async () => {
    try {
      const { data } =
        await api.get<PaginatedResponse<Submission>>("/submissions/");
      setSubmissions(data.results);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded(expanded === id ? null : id);
    setShareFileId(null);
    setShareMsg("");
  };

  const loadShares = async (fileId: number) => {
    try {
      const { data } = await api.get<PaginatedResponse<FileShare>>(
        "/submissions/shares/",
        { params: { file: fileId } },
      );
      setShares((prev) => ({ ...prev, [fileId]: data.results }));
    } catch {
      // ignore
    }
  };

  const handleShare = async (fileId: number) => {
    if (!shareUsername.trim()) return;
    setSharing(true);
    setShareMsg("");
    try {
      await api.post("/submissions/shares/", {
        file: fileId,
        shared_with_username: shareUsername.trim(),
      });
      setShareMsg("Shared!");
      setShareUsername("");
      loadShares(fileId);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Share failed";
      setShareMsg(msg);
    } finally {
      setSharing(false);
    }
  };

  const deleteSubmission = async (id: number) => {
    if (!confirm("Delete this submission?")) return;
    try {
      await api.delete(`/submissions/${id}/`);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const downloadUrl = (file: SubmissionFile) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    return `${base}/submissions/files/${file.id}/download/`;
  };

  if (loading) {
    return <p className="text-gray-500">Loading submissions…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>

      {submissions.length === 0 ? (
        <p className="text-gray-500">
          No submissions yet. Use the Data Browser to extract data.
        </p>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="border rounded-lg bg-white shadow-sm">
              {/* Header row */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(sub.id)}
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-800">#{sub.id}</span>
                  <span className="text-sm text-gray-600">
                    {sub.connection_name ?? `conn #${sub.connection}`}
                  </span>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    {sub.table_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {sub.row_count} rows
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(sub.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSubmission(sub.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Delete
                  </button>
                  <span className="text-gray-400">
                    {expanded === sub.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === sub.id && (
                <div className="border-t px-4 py-4 space-y-4">
                  {/* Data preview */}
                  {sub.data && sub.data.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        Data preview ({Math.min(sub.data.length, 5)} of{" "}
                        {sub.data.length} rows)
                      </summary>
                      <div className="mt-2 overflow-auto max-h-48 border rounded">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {Object.keys(sub.data[0]).map((k) => (
                                <th
                                  key={k}
                                  className="px-2 py-1 text-left font-medium"
                                >
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {sub.data.slice(0, 5).map((row, i) => (
                              <tr key={i}>
                                {Object.keys(sub.data[0]).map((k) => (
                                  <td
                                    key={k}
                                    className="px-2 py-1 whitespace-nowrap"
                                  >
                                    {row[k] === null ? "—" : String(row[k])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  {/* Files */}
                  <div>
                    <h3 className="font-medium text-gray-700 text-sm mb-2">
                      Exported Files
                    </h3>
                    {sub.files.length === 0 ? (
                      <p className="text-sm text-gray-400">No files</p>
                    ) : (
                      <div className="space-y-2">
                        {sub.files.map((f) => (
                          <div
                            key={f.id}
                            className="border rounded p-3 bg-gray-50 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded uppercase">
                                  {f.format}
                                </span>
                                <a
                                  href={downloadUrl(f)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  Download
                                </a>
                              </div>
                              <button
                                onClick={() => {
                                  setShareFileId(
                                    shareFileId === f.id ? null : f.id,
                                  );
                                  setShareMsg("");
                                  setShareUsername("");
                                  loadShares(f.id);
                                }}
                                className="text-xs text-gray-500 hover:text-gray-800"
                              >
                                {shareFileId === f.id ? "Close" : "Share"}
                              </button>
                            </div>

                            {/* Share form */}
                            {shareFileId === f.id && (
                              <div className="mt-3 space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Username to share with"
                                    value={shareUsername}
                                    onChange={(e) =>
                                      setShareUsername(e.target.value)
                                    }
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                  />
                                  <button
                                    onClick={() => handleShare(f.id)}
                                    disabled={sharing}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {sharing ? "…" : "Share"}
                                  </button>
                                </div>
                                {shareMsg && (
                                  <p
                                    className={`text-xs ${shareMsg === "Shared!" ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {shareMsg}
                                  </p>
                                )}
                                {/* Existing shares */}
                                {shares[f.id] && shares[f.id].length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Shared with:{" "}
                                    {shares[f.id]
                                      .map((s) => s.shared_with_username)
                                      .join(", ")}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
