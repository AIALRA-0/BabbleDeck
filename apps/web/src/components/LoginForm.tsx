"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (value === "/login" || value.startsWith("/account/password")) {
    return "/dashboard";
  }
  return value;
}

type LoginResponse = {
  ok: boolean;
  data?: {
    user?: {
      passwordRotationRequired?: boolean;
    };
  };
};

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/api/auth/login"
      className="space-y-4"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        setPending(false);
        if (!response.ok) {
          setError("Sign-in failed. Check your credentials and try again.");
          return;
        }
        const payload = (await response
          .json()
          .catch(() => null)) as LoginResponse | null;
        router.push(
          payload?.data?.user?.passwordRotationRequired
            ? `/account/password?next=${encodeURIComponent(next)}`
            : next,
        );
        router.refresh();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="text-sm font-medium text-red-700">{error}</p>
      ) : null}
      <Button className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}
