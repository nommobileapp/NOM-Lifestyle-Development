# NOM Trip Planner database setup

This schema is committed on `feature/trip-planner-foundation` and has been applied to the shared NOM Supabase project `nom-lifestyle` after explicit approval. It adds three new tables and does not modify existing NOM tables or records.

## Tables

- `public.trips`: private trip ownership, destination, dates, optional budget and AI opt-in.
- `public.trip_items`: day-by-day itinerary entries, including places, flights, stays, activities, meals and transport.
- `public.trip_expenses`: expense records for the flexible trip budget.

## Security

All three tables enable Row Level Security. Policies restrict every operation to rows whose `owner_id` matches the authenticated user's `auth.uid()`. Child rows use a composite foreign key to ensure they belong to a trip owned by the same member. New trips default to private and AI is off by default.

## Before testing the branch

1. The schema has been applied to the shared NOM Supabase project.
2. Verified: all three tables exist, RLS is enabled, each has four owner-only policies, and the `authenticated` role has SELECT, INSERT, UPDATE and DELETE privileges.
3. Sign in to NOM and open **My Trip** on a preview of this branch. The app still needs end-to-end member testing.

No booking API keys, payment data or external provider credentials are required for this foundation. External booking links are stored as itinerary references only.

## Optional location-aware AI suggestions

- Edge Function: `nom-trip-suggestions` (JWT verification enabled).
- AI is off by default per trip. Members explicitly enable it when creating a trip or from that trip's detail view, and can turn it off again.
- When requested, the browser sends only that member's RLS-loaded saved-place details and the current trip context to the function. The function does not read other members' saved places or persist the prompt.
- The function uses available coordinates to calculate approximate straight-line proximity between saved places, then asks the AI to group nearby stops and reduce backtracking. Straight-line proximity is not a road route or travel-time estimate.
- If coordinates are missing, it uses only clearly matching address/area text and tells the member when location confidence is limited. It must not invent distances, travel times, opening hours or locations.
- Each compact suggestion transfers its place, suggested date/time and notes into the existing itinerary form. The member edits and saves manually.
- The function uses the existing `OPENAI_API_KEY` Edge Function secret. No OpenAI key is exposed in the browser. End-to-end invocation still needs member testing on the deployed app.
