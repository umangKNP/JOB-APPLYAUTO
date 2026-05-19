import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
if (!BACKEND_URL && process.env.NODE_ENV === "production") {
  throw new Error(
    "REACT_APP_BACKEND_URL is required for production deployments. Set it in Settings → Secrets and variables → Actions → Variables.",
  );
}
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});
