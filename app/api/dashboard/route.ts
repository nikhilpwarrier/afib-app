import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("checkins")
    .select(
      "id, created_at, patient_name, patient_email, patient_dob, patient_id, result, chest_pain, dyspnea, lightheadedness, wants_care_team_contact, would_have_gone_to_ed, contacted, admin_notes, contacted_by, contacted_at, disposition"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}