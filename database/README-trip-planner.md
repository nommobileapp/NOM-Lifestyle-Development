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
