import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Darzi Register Admin",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Darzi Register</h1>
        <p className="mt-1 text-sm text-neutral-500">Admin sign in</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
