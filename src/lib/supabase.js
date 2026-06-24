// src/lib/supabase.js
//
// Supabase client + data access helpers matching schema.sql.
// Fill in your project URL and anon key once you've decided on the project.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Titles -----------------------------------------------------------

export async function upsertTitle(title) {
  const { data, error } = await supabase
    .from("wl_titles")
    .upsert(
      {
        source: title.source,
        source_id: title.source_id,
        media_type: title.media_type,
        title: title.title,
        art_url: title.art_url,
        logline: title.logline,
        tags: title.tags,
        year: title.year,
      },
      { onConflict: "source,source_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Interactions -------------------------------------------------------

export async function recordInteraction({ userId, titleId, direction, rating, tellMore, portal }) {
  const { error } = await supabase.from("wl_interactions").insert({
    user_id: userId,
    title_id: titleId,
    direction,
    rating: rating ?? null,
    tell_more: tellMore ?? null,
    portal,
  });
  if (error) throw error;

  await touchCooldown(titleId);
}

export async function getHistory(userId, portal) {
  const { data, error } = await supabase
    .from("wl_interactions")
    .select("direction, rating, title_id, wl_titles(title, tags)")
    .eq("user_id", userId)
    .eq("portal", portal)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(d => ({
    title: d.wl_titles.title,
    tags: d.wl_titles.tags,
    rating: d.rating,
    direction: d.direction,
  }));
}

// --- Cooldown -------------------------------------------------------------

async function touchCooldown(titleId) {
  const { data: existing } = await supabase
    .from("wl_cooldown")
    .select("times_shown")
    .eq("title_id", titleId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("wl_cooldown")
      .update({ last_shown_at: new Date().toISOString(), times_shown: existing.times_shown + 1 })
      .eq("title_id", titleId);
  } else {
    await supabase.from("wl_cooldown").insert({ title_id: titleId });
  }
}

export async function getRecentlyShownTitleNames(limit = 150) {
  const { data, error } = await supabase
    .from("wl_cooldown")
    .select("last_shown_at, wl_titles(title)")
    .order("last_shown_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(d => d.wl_titles.title);
}

// --- Saved list -------------------------------------------------------------

export async function addToSavedList({ userId, titleId, addedVia = "swipe" }) {
  const { error } = await supabase
    .from("wl_saved_list")
    .upsert({ user_id: userId, title_id: titleId, added_via: addedVia }, { onConflict: "user_id,title_id" });
  if (error) throw error;
}

export async function getSavedList(userId) {
  const { data, error } = await supabase
    .from("wl_saved_list")
    .select("id, status, added_via, created_at, wl_titles(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// --- Recommendations (calls the Netlify Function, not Claude directly) ---

export async function fetchRecommendations({ history, portal, excludeTitles = [], count = 25 }) {
  const res = await fetch("/.netlify/functions/get-recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, portal, excludeTitles, count }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Recommendation request failed (${res.status})`);
  }
  const data = await res.json();
  return data.recommendations;
}
