/**
 * Tests for TypeScript type definitions - ensure interfaces compile correctly
 * and can be instantiated with expected shapes.
 */
import type {
  User,
  Connection,
  Submission,
  SubmissionFile,
  FileShare,
  AuditLog,
  PaginatedResponse,
} from "@/lib/types";

describe("TypeScript Interfaces", () => {
  test("User interface has correct shape", () => {
    const user: User = {
      id: 1,
      username: "testuser",
      email: "test@example.com",
      role: "user",
      is_active: true,
      date_joined: "2025-01-01T00:00:00Z",
      last_login: null,
    };
    expect(user.role).toBe("user");
    expect(user.is_active).toBe(true);
  });

  test("Connection interface has correct shape", () => {
    const conn: Connection = {
      id: 1,
      name: "Test PG",
      db_type: "postgresql",
      host: "localhost",
      port: 5432,
      database: "testdb",
      username: "pguser",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    expect(conn.db_type).toBe("postgresql");
  });

  test("Submission interface includes files array", () => {
    const sub: Submission = {
      id: 1,
      connection: 1,
      connection_name: "PG Conn",
      table_name: "users",
      row_count: 10,
      data: [{ id: 1, name: "Alice" }],
      owner: 1,
      created_at: "2025-01-01T00:00:00Z",
      files: [],
    };
    expect(sub.files).toEqual([]);
    expect(sub.row_count).toBe(10);
  });

  test("PaginatedResponse wraps results correctly", () => {
    const page: PaginatedResponse<User> = {
      count: 50,
      next: "http://example.com?page=2",
      previous: null,
      results: [
        {
          id: 1,
          username: "a",
          email: "a@b.com",
          role: "admin",
          is_active: true,
          date_joined: "",
          last_login: null,
        },
      ],
    };
    expect(page.count).toBe(50);
    expect(page.results).toHaveLength(1);
    expect(page.results[0].role).toBe("admin");
  });

  test("FileShare interface has sharing metadata", () => {
    const share: FileShare = {
      id: 1,
      file: 5,
      shared_with: 2,
      shared_with_username: "bob",
      shared_by: 1,
      shared_by_username: "alice",
      created_at: "2025-01-01T00:00:00Z",
    };
    expect(share.shared_with_username).toBe("bob");
  });

  test("AuditLog interface has action and detail", () => {
    const log: AuditLog = {
      id: 1,
      user: 1,
      username: "admin",
      action: "login",
      detail: { ip: "127.0.0.1" },
      ip_address: "127.0.0.1",
      created_at: "2025-01-01T00:00:00Z",
    };
    expect(log.action).toBe("login");
  });

  test("Connection db_type is restricted to valid choices", () => {
    const validTypes: Connection["db_type"][] = [
      "postgresql",
      "mysql",
      "mongodb",
      "clickhouse",
    ];
    expect(validTypes).toHaveLength(4);
  });
});
