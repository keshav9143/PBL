import { useCallback, useEffect, useState } from "react";
import App from "./App";
import AuthGate from "./AuthGate";
import {
  clearAuthSession,
  getStoredUser,
  verifySession,
  type AuthUser,
} from "./api";

export default function AuthRoot() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    const savedUser = getStoredUser();
    const token = sessionStorage.getItem("cartos_token");

    if (!token || !savedUser) {
      clearAuthSession();
      setUser(null);
      setChecking(false);
      return;
    }

    try {
      const result = await verifySession();
      setUser(result.user);
    } catch {
      clearAuthSession();
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (checking) {
    return (
      <main className="auth-page">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={() => void checkSession()} />;
  }

  return (
    <App
      user={user}
      onLogout={() => {
        clearAuthSession();
        setUser(null);
      }}
    />
  );
}

