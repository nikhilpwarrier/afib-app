import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Missing service key env var" },
        { status: 500 }
      );
    }

    // Debug: show exactly what hostname the deployed app is trying to use
    let hostname = "unable-to-parse";
    try {
      hostname = new URL(supabaseUrl).hostname;
    } catch {
      hostname = `INVALID_URL:${supabaseUrl}`;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          debug: {
            supabaseUrl,
            hostname,
          },
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      debug: {
        supabaseUrl,
        hostname,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}