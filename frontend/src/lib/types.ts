export interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface Connection {
  id: number;
  name: string;
  db_type: "postgresql" | "mysql" | "mongodb" | "clickhouse";
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: number;
  connection: number;
  connection_name: string | null;
  table_name: string;
  row_count: number;
  data: Record<string, unknown>[];
  owner: number;
  created_at: string;
  files: SubmissionFile[];
}

export interface SubmissionFile {
  id: number;
  submission: number;
  file: string;
  format: "json" | "csv";
  source_metadata: Record<string, unknown>;
  owner: number;
  created_at: string;
  download_url: string;
}

export interface FileShare {
  id: number;
  file: number;
  shared_with: number;
  shared_with_username: string;
  shared_by: number;
  shared_by_username: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user: number;
  username: string | null;
  action: string;
  detail: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
