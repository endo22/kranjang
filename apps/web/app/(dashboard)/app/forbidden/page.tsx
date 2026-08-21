import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>403</CardTitle>
        <CardDescription>Anda tidak memiliki izin untuk membuka halaman ini.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[#616161]">
          Minta owner atau administrator tenant untuk memberikan permission yang sesuai pada role Anda.
        </p>
        <Button asChild>
          <Link href="/app">Kembali ke dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
