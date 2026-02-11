import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the requesting user is an admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || roleData?.role !== "admin") {
      console.error("Role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to get all users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("List users error:", listError);
      throw listError;
    }

    // Get profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error("Profiles error:", profilesError);
    }

    // Get roles
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Roles error:", rolesError);
    }

    // Get activity counts
    const { data: activityCounts, error: activityError } = await adminClient
      .from("user_activity")
      .select("user_id, event_type");

    if (activityError) {
      console.error("Activity error:", activityError);
    }

    // Aggregate activity counts per user
    const activityMap: Record<
      string,
      { total: number; page_loads: number; copy_events: number; yacht_views: number; trips_booked: number }
    > = {};
    activityCounts?.forEach((activity) => {
      if (!activityMap[activity.user_id]) {
        activityMap[activity.user_id] = {
          total: 0,
          page_loads: 0,
          copy_events: 0,
          yacht_views: 0,
          trips_booked: 0,
        };
      }
      activityMap[activity.user_id].total++;
      if (activity.event_type === "page_load") activityMap[activity.user_id].page_loads++;
      if (activity.event_type === "copy_text") activityMap[activity.user_id].copy_events++;
      if (activity.event_type === "yacht_view") activityMap[activity.user_id].yacht_views++;
      if (activity.event_type === "trip_booked") activityMap[activity.user_id].trips_booked++;
    });

    // Combine data
    const enrichedUsers = users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      const role = roles?.find((r) => r.user_id === authUser.id);
      const activity = activityMap[authUser.id] || {
        total: 0,
        page_loads: 0,
        copy_events: 0,
        yacht_views: 0,
        trips_booked: 0,
      };

      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        role: role?.role || "staff",
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        activity_count: activity.total,
        page_loads: activity.page_loads,
        copy_events: activity.copy_events,
        yacht_views: activity.yacht_views,
        trips_booked: activity.trips_booked,
      };
    });

    console.log(`Returning ${enrichedUsers.length} users`);

    return new Response(JSON.stringify(enrichedUsers), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-users:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
