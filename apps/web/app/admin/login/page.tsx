"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, jsonInit, setAccessToken } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kranjang.local");
  const [password, setPassword] = useState("ChangeMeAdmin12");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Masuk Super Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              void api<{ accessToken: string }>("/admin/auth/login", {
                method: "POST",
                ...jsonInit({ email, password }),
              }, { includeAuthorization: false, retryOnUnauthorized: false })
                .then((result) => {
                  setAccessToken(result.accessToken);
                  sessionStorage.setItem("kranjang_admin_token", result.accessToken);
                  router.push("/admin");
                })
                .catch((submitError) => setError(submitError instanceof Error ? submitError.message : "Gagal masuk"));
            }}
          >
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <p className="text-sm text-[#a32626]">{error}</p> : null}
            <Button type="submit" className="w-full">Masuk</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
