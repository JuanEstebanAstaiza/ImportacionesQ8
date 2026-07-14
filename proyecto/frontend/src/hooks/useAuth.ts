import { useAuthContext } from "@/app/providers/AuthContext";

export function useAuth() {
  return useAuthContext();
}
