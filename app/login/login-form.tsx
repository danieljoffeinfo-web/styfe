"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { isAllowedEmail } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isAllowedEmail(email)) {
      setError("That address is not allowed to use Styfe HQ.");
      return;
    }

    setState("sending");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="card p-5">
        <p className="text-sm font-medium">Check your inbox.</p>
        <p className="mt-1 text-[13px] text-muted">
          A sign-in link is on its way to {email}. It expires in an hour.
        </p>
        <Button className="mt-4" variant="ghost" onClick={() => setState("idle")}>
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-5">
      <Field label="Email address" htmlFor="email" error={error ?? undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
