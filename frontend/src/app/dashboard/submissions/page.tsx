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
  const [downloading, setDownloading] = useState<number | null>(null);

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

  const handleDownload = async (file: SubmissionFile) => {
    setDownloading(file.id);
    try {
      const response = await api.get(
        `/submissions/files/${file.id}/download/`,
        { responseType: "blob" },
      );
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition or generate one
      const disposition = response.headers["content-disposition"];
      let filename = `submission_${file.submission}_${file.id}.${file.format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading submissions…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {submissions.length} submission{submissions.length !== 1 && "s"}{" "}
            total
          </p>
        </div>
        <button
          onClick={fetchSubmissions}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No submissions yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Use the Data Browser to extract and submit data.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition hover:shadow-md"
            >
              {/* Header row */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => toggleExpand(sub.id)}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                    {sub.id}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {sub.table_name}
                      </span>
                      <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {sub.connection_name ?? `Connection #${sub.connection}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 7h16M4 12h16M4 17h7"
                          />
                        </svg>
                        {sub.row_count.toLocaleString()} rows
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        {sub.files.length} file{sub.files.length !== 1 && "s"}
                      </span>
                      <span>{new Date(sub.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSubmission(sub.id);
                    }}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                    title="Delete submission"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expanded === sub.id ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === sub.id && (
                <div className="border-t border-gray-100 px-5 py-5 bg-gray-50/50 space-y-5">
                  {/* Data preview */}
                  {sub.data && sub.data.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                        📊 Data preview ({Math.min(sub.data.length, 5)} of{" "}
                        {sub.data.length} rows)
                      </summary>
                      <div className="mt-3 overflow-auto max-h-56 border rounded-lg bg-white">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {Object.keys(sub.data[0]).map((k) => (
                                <th
                                  key={k}
                                  className="px-3 py-2 text-left font-semibold text-gray-700"
                                >
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sub.data.slice(0, 5).map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                {Object.keys(sub.data[0]).map((k) => (
                                  <td
                                    key={k}
                                    className="px-3 py-2 whitespace-nowrap text-gray-600"
                                  >
                                    {row[k] === null ? (
                                      <span className="text-gray-400 italic">
                                        NULL
                                      </span>
                                    ) : (
                                      String(row[k])
                                    )}
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
                    <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      Exported Files
                    </h3>
                    {sub.files.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">
                        No files exported
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sub.files.map((f) => (
                          <div
                            key={f.id}
                            className="border border-gray-200 rounded-lg p-4 bg-white"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${
                                    f.format === "json"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {f.format}
                                </span>
                                <button
                                  onClick={() => handleDownload(f)}
                                  disabled={downloading === f.id}
                                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium text-sm transition disabled:opacity-50"
                                >
                                  {downloading === f.id ? (
                                    <>
                                      <svg
                                        className="animate-spin h-4 w-4"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          fill="none"
                                        />
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                      </svg>
                                      Downloading…
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                      </svg>
                                      Download
                                    </>
                                  )}
                                </button>
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
                                className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                                  shareFileId === f.id
                                    ? "bg-gray-200 text-gray-700"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                  />
                                </svg>
                                {shareFileId === f.id ? "Close" : "Share"}
                              </button>
                            </div>

                            {/* Share form */}
                            {shareFileId === f.id && (
                              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Enter username to share with…"
                                    value={shareUsername}
                                    onChange={(e) =>
                                      setShareUsername(e.target.value)
                                    }
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() => handleShare(f.id)}
                                    disabled={sharing || !shareUsername.trim()}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                  >
                                    {sharing ? "Sharing…" : "Share"}
                                  </button>
                                </div>
                                {shareMsg && (
                                  <p
                                    className={`text-xs font-medium ${
                                      shareMsg === "Shared!"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {shareMsg}
                                  </p>
                                )}
                                {shares[f.id] && shares[f.id].length > 0 && (
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="text-gray-500 font-medium">
                                      Shared with:
                                    </span>
                                    {shares[f.id].map((s) => (
                                      <span
                                        key={s.id}
                                        className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                                      >
                                        {s.shared_with_username}
                                      </span>
                                    ))}
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
