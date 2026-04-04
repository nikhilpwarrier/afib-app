import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    if (!serviceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY");
      return NextResponse.json(
        { error: "Missing service key env var" },
        { status: 500 }
      );
    }

    const patientId = req.nextUrl.searchParams.get("patient_id");

    if (!patientId) {
      return NextResponse.json(
        { error: "Missing patient_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("checkins")
      .select("id, created_at, result, would_have_gone_to_ed")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase history query error:", error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Unhandled /api/history error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unknown server error in /api/history",
      },
      { status: 500 }
    );
  }
}