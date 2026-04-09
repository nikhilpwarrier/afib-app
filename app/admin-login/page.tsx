"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

const ADMIN_SESSION_KEY = "atria_admin_auth";

function PrototypeFooter() {
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: "1px solid #e5e7eb",
        color: "#64748b",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      Prototype only. This tool is for workflow demonstration and pilot testing.
      Do not enter patient names, MRNs, dates of birth, or other direct
      identifiers.
    </div>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const existing =
      typeof window !== "undefined"
        ? localStorage.getItem(ADMIN_SESSION_KEY)
        : null;

    if (existing === "true") {
      router.replace("/dashboard");
    }
  }, [router]);

  function handleLogin() {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    if (!expected) {
      setError("Admin password is not configured.");
      return;
    }

    if (password === expected) {
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      router.push("/dashboard");
      return;
    }

    setError("Incorrect password.");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 24,
        color: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 24,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 14,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
  <Logo size={140} />
  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
    Admin Access
  </div>
</div>

          <div style={{ display: "flex", gap: 16 }}>
            <a href="/" style={{ textDecoration: "none", color: "#111827" }}>
              Check-In
            </a>
            <a
              href="/admin-login"
              style={{
                textDecoration: "none",
                color: "#111827",
                fontWeight: 700,
              }}
            >
              Admin Login
            </a>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 28,
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>Admin Login</h1>
          <div style={{ color: "#64748b", marginBottom: 20 }}>
            Dashboard access is restricted to the care team.
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 18,
            }}
          >
            Internal prototype for pilot evaluation only. Do not use as the sole
            source of clinical decision-making. Do not enter direct patient
            identifiers.
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #d1d5db",
                fontSize: 15,
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              background: "#111827",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>

          <PrototypeFooter />
        </div>
      </div>
    </main>
  );
}