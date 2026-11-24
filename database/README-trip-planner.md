# NOM Trip Planner database setup

This schema is prepared for the `feature/trip-planner-foundation` branch. It has **not** been applied to the live NOM Supabase project.

## Tables

- `public.trips`: private trip ownership, destination, dates, optional budget and AI opt-in.
- `public.trip_items`: day-by-day itinerary entries, including places, flights, stays, activities, meals and transport.
- `public.trip_expenses`: expense records for the flexible trip budget.

## Security

All three tables enable Row Level Security. Policies restrict every operation to rows whose `owner_id` matches the authenticated user's `auth.uid()`. Child rows use a composite foreign key to ensure they belong to a trip owned by the same member. New trips default to private and AI is off by default.

## Before testing the branch

1. Review and run `trip-planner-schema.sql` in the NOM Supabase SQL Editor.
2. In the Supabase project's Data API settings, confirm that `trips`, `trip_items`, and `trip_expenses` are exposed to the Data API. New public tables are not automatically exposed on current Supabase projects.
3. Confirm authenticated role access is present (the SQL grants SELECT, INSERT, UPDATE and DELETE to `authenticated`).
4. Sign in to NOM and open **My Trip**.

No booking API keys, payment data or external provider credentials are required for this foundation. External booking links are stored as itinerary references only.
