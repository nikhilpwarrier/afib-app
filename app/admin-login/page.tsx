"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    // Simple prototype credentials
    if (
      email === "admin@afibapp.com" &&
      password === "Admin123!"
    ) {
      localStorage.setItem("afib_admin_logged_in", "true");
      window.location.href = "/dashboard";
      return;
    }

    alert("Invalid admin credentials");
  }

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Admin Login</h1>
        <p className="text-gray-600 mb-6">
          Authorized clinicians and admins only.
        </p>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-black text-white py-2 font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}