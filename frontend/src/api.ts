const API_BASE_URL = "http://127.0.0.1:5000";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  message: string;
  access_token: string;
  user: AuthUser;
}

export function saveAuthSession(data: AuthResponse) {
  sessionStorage.setItem("cartos_token", data.access_token);
  sessionStorage.setItem("cartos_user", JSON.stringify(data.user));
}

export function clearAuthSession() {
  sessionStorage.removeItem("cartos_token");
  sessionStorage.removeItem("cartos_user");
}

export function getStoredUser(): AuthUser | null {
  const savedUser = sessionStorage.getItem("cartos_user");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("cartos_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }

    throw new Error(
      data.error || `Request failed: ${response.status} ${response.statusText}`
    );
  }

  return data as T;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return readResponse<AuthResponse>(response);
}

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  return readResponse<{ message: string; user: AuthUser }>(response);
}

export async function verifySession() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
  });

  return readResponse<{ user: AuthUser }>(response);
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  });

  return readResponse<T>(response);
}

async function apiSend<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return readResponse<T>(response);
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total_amount: number;
}

export interface OSJob {
  id: number;
  order_id: number;
  process_id: string;
  process_state: string;
  scheduling_algorithm: string;
  priority: number;
  burst_time: number;
  arrival_time: number;
  waiting_time: number;
  turnaround_time: number;
  response_time: number;
}

export interface ProductInput {
  name: string;
  description: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

export const getProducts = () =>
  apiGet<{ count: number; products: Product[] }>("/api/products/");

export const getOrders = () =>
  apiGet<{ count: number; orders: Order[] }>("/api/orders/");

export const getJobs = () =>
  apiGet<{ count: number; jobs: OSJob[] }>("/api/jobs/");

export const getHealth = () =>
  apiGet<{ status: string }>("/api/health");

export const getSchedulerComparison = () =>
  apiGet<Record<string, unknown>>("/api/scheduler/compare");

export const createProduct = (product: ProductInput) =>
  apiSend<{ message: string; product: Product }>(
    "/api/products/", "POST", product
  );

export const updateProduct = (
  id: number,
  changes: Partial<ProductInput> & { is_active?: boolean }
) =>
  apiSend<{ message: string }>(
    `/api/products/${id}`, "PATCH", changes
  );

export const deleteProduct = (id: number) =>
  apiSend<{ message: string }>(
    `/api/products/${id}`, "DELETE"
  );

export async function runScheduler(algorithm: string, quantum = 2) {
  return apiSend<Record<string, unknown>>(
    "/api/scheduler/run",
    "POST",
    { algorithm, quantum }
  );
}

export interface CreateOrderInput {
  items: { product_id: number; quantity: number }[];
}

export const createOrder = (order: CreateOrderInput) =>
  apiSend<{
    message: string;
    order: {
      id: number;
      user_id: number;
      status: string;
      total_amount: number;
    };
  }>("/api/orders/", "POST", order);

export const getOrderDetails = (id: number) =>
  apiGet<{
    id: number;
    user_id: number;
    status: string;
    total_amount: number;
    items: { product_id: number; quantity: number; unit_price: number }[];
  }>(`/api/orders/${id}`);

export async function runDemoSimulation() {
  const processes = [
    { id: 101, process_id: "DEMO-P1", arrival_time: 0, burst_time: 7, priority: 3 },
    { id: 102, process_id: "DEMO-P2", arrival_time: 2, burst_time: 4, priority: 1 },
    { id: 103, process_id: "DEMO-P3", arrival_time: 4, burst_time: 1, priority: 4 },
    { id: 104, process_id: "DEMO-P4", arrival_time: 5, burst_time: 4, priority: 2 },
  ];

  return apiSend<Record<string, unknown>>(
    "/api/scheduler/demo",
    "POST",
    { processes, quantum: 2 }
  );
}
