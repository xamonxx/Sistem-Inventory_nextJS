"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button, Card, Input, Label } from "@/components/ui";
import { Boxes } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <Boxes size={26} />
          </div>
          <h1 className="text-lg font-bold">PUTRA CORPORATION</h1>
          <p className="text-sm text-muted">Sistem Inventory &amp; Kasir</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" placeholder="kasir / gudang" autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" />
          </div>

          {state?.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Demo: <b>kasir</b>/password &middot; <b>gudang</b>/password
        </p>
      </Card>
    </div>
  );
}
