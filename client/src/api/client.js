const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("smartattend_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (
    options.body &&
    typeof options.body === "object" &&
    !(options.body instanceof FormData)
  ) {
    config.body = JSON.stringify(options.body);
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, config);

    // Check for 401 unauthorized / session expiry
    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      if (token && data.code === "TOKEN_EXPIRED") {
        localStorage.removeItem("smartattend_token");
        localStorage.removeItem("smartattend_user");
        window.dispatchEvent(new Event("auth:logout"));
      }
      throw new Error(data.message || "Please log in to continue.");
    }

    // Handle CSV or non-JSON downloads
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/csv")) {
      return response.blob();
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || "An error occurred during request.",
      );
      error.code = data.code;
      error.errors = data.errors;
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  get: (url, options) => apiRequest(url, { method: "GET", ...options }),
  post: (url, body, options) =>
    apiRequest(url, { method: "POST", body, ...options }),
  put: (url, body, options) =>
    apiRequest(url, { method: "PUT", body, ...options }),
  delete: (url, options) => apiRequest(url, { method: "DELETE", ...options }),
};
