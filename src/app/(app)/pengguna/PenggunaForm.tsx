"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUser } from "./actions";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { Plus, X } from "lucide-react";

export function PenggunaForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveUser, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) { setOpen(false); ref.current?.reset(); router.refresh(); }
  }, [state, router]);

  if (!open) return <Button onClick={() => setOpen(true)}><Plus size={18} /> Tambah Pengguna</Button>;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Tambah Pengguna</h2>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground"><X size={20} /></button>
      </div>
      <form action={formAction} ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><Label>Username</Label><Input name="username" required /></div>
        <div><Label>Nama Lengkap</Label><Input name="nama" required /></div>
        <div>
          <Label>Role</Label>
          <Select name="role" required>
            <option value="ADMIN_KASIR">Admin Kasir</option>
            <option value="ADMIN_GUDANG">Admin Gudang</option>
          </Select>
        </div>
        <div><Label>Password</Label><Input name="password" type="password" required /></div>
        {state?.error && <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
        </div>
      </form>
    </Card>
  );
}
