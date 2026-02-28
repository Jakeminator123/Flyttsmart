"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function StartContent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="flex flex-col items-center gap-6 py-8">
          <p className="text-center text-lg font-medium text-foreground">
            Den här länken är inte längre aktiv
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/adressandring">Till formuläret</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Till startsidan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Card className="w-full max-w-sm shadow-xl">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <p className="text-lg font-medium text-foreground">Laddar...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <StartContent />
    </Suspense>
  );
}
