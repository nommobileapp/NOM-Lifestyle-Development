import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function distanceKm(a: any, b: any): number | null {
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) ||
      !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Use POST." }, { status: 405, headers: corsHeaders });
  }
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return Response.json({ error: "NOM AI is not configured yet." }, { status: 503, headers: corsHeaders });

  try {
    const body = await req.json();
    const destination = typeof body?.destination === "string" ? body.destination.trim().slice(0, 160) : "";
    const startDate = typeof body?.start_date === "string" ? body.start_date : "";
    const endDate = typeof body?.end_date === "string" ? body.end_date : "";
    const places = Array.isArray(body?.saved_places) ? body.saved_places.slice(0, 40) : [];
    const existing = Array.isArray(body?.existing_items) ? body.existing_items.slice(0, 30) : [];
    if (!destination || !places.length) {
      return Response.json({ error: "Add a destination and save some places first." }, { status: 400, headers: corsHeaders });
    }

    const cleanPlaces = places.map((p: any) => ({
      place_key: String(p?.place_key || "").slice(0, 180),
      name: String(p?.name || "Saved place").slice(0, 160),
      category: String(p?.category || "place").slice(0, 60),
      address: String(p?.address || "").slice(0, 240),
      latitude: Number.isFinite(p?.latitude) && Math.abs(p.latitude) <= 90 ? p.latitude : null,
      longitude: Number.isFinite(p?.longitude) && Math.abs(p.longitude) <= 180 ? p.longitude : null,
      description: String(p?.description || "").slice(0, 260),
    })).filter((p: any) => p.place_key && p.name);

    if (!cleanPlaces.length) return Response.json({ error: "No usable saved places were found." }, { status: 400, headers: corsHeaders });

    // Supply explicit, approximate proximity evidence to the model. These are straight-line distances,
    // never road distances or travel-time estimates.
    for (const place of cleanPlaces) {
      place.nearby_places = cleanPlaces
        .filter((other: any) => other.place_key !== place.place_key)
        .map((other: any) => ({ place_key: other.place_key, distance_km: distanceKm(place, other) }))
        .filter((x: any) => x.distance_km !== null && x.distance_km <= 12)
        .sort((a: any, b: any) => a.distance_km - b.distance_km)
        .slice(0, 6)
        .map((x: any) => ({ place_key: x.place_key, approximate_straight_line_km: Math.round(x.distance_km * 10) / 10 }));
      place.location_quality = place.latitude !== null && place.longitude !== null
        ? "coordinates"
        : place.address ? "address_only" : "unknown";
    }

    const dayCount = startDate && endDate
      ? Math.max(1, Math.min(21, Math.floor((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1))
      : 1;

    const system = [
      "You are NOM's private travel-planning assistant.",
      "Create a practical day-by-day route using ONLY the member's supplied saved places. Never invent places, addresses, coordinates, opening hours, road distances, travel times, prices, or services.",
      "Geography is a primary constraint. Use nearby_places evidence to group close stops on the same day and order them to reduce backtracking. The supplied distances are approximate straight-line distances, NOT road distances. Never present them as driving or walking distances.",
      "If coordinates are missing, group only when supplied address/area text clearly indicates the same area. Do not infer proximity from place names alone. Clearly say when location accuracy is limited.",
      "Prioritise places matching the trip destination. Exclude places clearly unrelated to the destination unless address context makes the match reasonable.",
      "Spread suggestions across the trip dates, use sensible meal/activity timing, and avoid duplicates already in existing_itinerary.",
      "Return JSON only with shape { suggestions: [{ place_key, day_offset, time, reason, notes, route_note }] }.",
      "Each suggestion must use an exact place_key from saved_places. day_offset is a zero-based integer within day_count. time is HH:MM or empty. Keep reason and notes concise.",
      "route_note must explain the location logic honestly, for example 'Grouped with nearby saved places; check road route before setting off' or 'Address-only match; confirm the location on the map'. Never invent route metrics."
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({
            destination, start_date: startDate, end_date: endDate, day_count: dayCount,
            saved_places: cleanPlaces, existing_itinerary: existing
          }) }
        ],
        temperature: 0.2,
        max_tokens: 1600
      })
    });

    const result = await response.json();
    if (!response.ok) {
      return Response.json({
        error: response.status === 429
          ? "NOM AI usage is temporarily unavailable. Check the AI account's usage limit."
          : "NOM AI could not create the route. Please try again."
      }, { status: response.status === 429 ? 429 : 502, headers: corsHeaders });
    }

    const parsed = JSON.parse(result?.choices?.[0]?.message?.content || "{}");
    const validKeys = new Set(cleanPlaces.map((p: any) => p.place_key));
    const suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
      .filter((x: any) => validKeys.has(String(x?.place_key)))
      .slice(0, 24)
      .map((x: any) => ({
        place_key: String(x.place_key),
        day_offset: Math.max(0, Math.min(dayCount - 1, Number.isFinite(Number(x.day_offset)) ? Math.floor(Number(x.day_offset)) : 0)),
        time: /^\d{2}:\d{2}$/.test(String(x.time || "")) ? String(x.time) : "",
        reason: String(x.reason || "").slice(0, 240),
        notes: String(x.notes || "").slice(0, 500),
        route_note: String(x.route_note || "").slice(0, 200)
      }));
    return Response.json({ suggestions }, { headers: corsHeaders });
  } catch (error) {
    console.error("NOM trip suggestion error:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Something went wrong while planning your route. Please try again." }, { status: 500, headers: corsHeaders });
  }
});