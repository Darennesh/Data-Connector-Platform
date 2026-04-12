/**
 * Tests for the API client (axios instance) configuration.
 * Validates baseURL, interceptors (token injection).
 */

let requestInterceptors: Function[] = [];
let responseInterceptors: { fulfilled: Function; rejected: Function }[] = [];

const mockInstance: any = {
  defaults: { baseURL: "http://localhost:8000/api" },
  interceptors: {
    request: {
      use: (fn: Function) => {
        requestInterceptors.push(fn);
      },
    },
    response: {
      use: (fulfilled: Function, rejected: Function) => {
        responseInterceptors.push({ fulfilled, rejected });
      },
    },
  },
  get: jest.fn(),
  post: jest.fn(),
};

const mockCreate = jest.fn(() => mockInstance);

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: mockCreate,
    post: jest.fn(),
  },
}));

describe("API Client", () => {
  beforeAll(() => {
    // Import triggers interceptor registration
    require("@/lib/api");
  });

  beforeEach(() => {
    localStorage.clear();
  });

  test("creates axios instance with correct baseURL", () => {
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: expect.stringContaining("/api"),
      }),
    );
  });

  test("registers request and response interceptors", () => {
    expect(requestInterceptors.length).toBeGreaterThan(0);
    expect(responseInterceptors.length).toBeGreaterThan(0);
  });

  test("request interceptor attaches Bearer token from localStorage", () => {
    localStorage.setItem("access_token", "test-token-123");
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptors[0](config);
    expect(result.headers.Authorization).toBe("Bearer test-token-123");
  });

  test("request interceptor skips token when not set", () => {
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptors[0](config);
    expect(result.headers.Authorization).toBeUndefined();
  });

  test("request interceptor returns config object", () => {
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptors[0](config);
    expect(result).toBe(config);
  });
});
