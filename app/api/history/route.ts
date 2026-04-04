import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patient_id");

  if (!patientId) {
    return NextResponse.json({ error: "Missing patient_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("checkins")
    .select("id, created_at, result, would_have_gone_to_ed")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}