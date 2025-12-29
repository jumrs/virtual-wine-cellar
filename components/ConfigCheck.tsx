"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function ConfigCheck() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          setError(`Supabase connection error: ${error.message}`);
        }
      } catch (err: any) {
        setError(`Failed to connect to Supabase: ${err.message}`);
      }
    };

    testConnection();
  }, []);

  if (!error) return null;

  return (
    <Card className="border-destructive m-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Configuration Error
        </CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          <p>Please check:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Your <code className="bg-muted px-1 rounded">.env.local</code> file has correct values</li>
            <li>Your Supabase project is active</li>
            <li>Your API keys are correct (check Supabase Dashboard → Settings → API)</li>
            <li>You&apos;ve restarted the dev server after changing .env.local</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}







