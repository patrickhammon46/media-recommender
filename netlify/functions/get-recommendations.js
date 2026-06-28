/**
 * netlify/functions/get-recommendations.js
 *
 * Server-side function. The frontend calls this endpoint instead of
 * Claude directly - the Anthropic API key lives only here, as a Netlify
 * environment variable, never shipped to the browser.
 *
 * v1 approach: Claude generates recommendations directly from its own
 * knowledge of real movies/TV shows - no TMDB integration. Tradeoff:
 * no poster art (placeholder art only), small chance of an occasional
 * factual slip (wrong year, etc). Upside: one less account/API key to set up.
 *
 * Deploy note: set ANTHROPIC_API_KEY in Netlify's dashboard under
 * Site settings -> Environment variables. Never commit it to a file.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { history, portal, excludeTitles, count } = JSON.parse(event.body);

    const historyText = history && history.length
      ? history.map(h => {
          if (h.direction === "up") return `LIKED "${h.title}" (rated ${h.rating}/10)`;
          if (h.direction === "down") return `DISLIKED "${h.title}"`;
          if (h.direction === "right") return `SAVED "${h.title}" (hasn't watched yet)`;
          return `SKIPPED "${h.title}"`;
        }).join("\n")
      : "No history yet - this is a new user, so favor broadly well-regarded titles.";

    const excludeText = excludeTitles && excludeTitles.length
      ? `\nDo NOT suggest any of these - already shown recently: ${excludeTitles.join(", ")}`
      : "";

    const mediaLabel = portal === "tv" ? "TV shows" : "movies";

    const prompt = `You are generating personal recommendations for a ${mediaLabel} discovery feed.

USER HISTORY:
${historyText}
${excludeText}

Generate ${count || 25} real, existing ${mediaLabel} this user hasn't seen, ranked best-first.
Every title must be a real, existing ${portal === "tv" ? "TV show" : "movie"} - never invent a title.
If you are not confident a title is real, leave it out.

For each, classify WHY it's a good pick using exactly one of these reason types:
- "acclaim": broadly well-regarded, not really tied to this user's specific history
- "similarity": shares concrete traits (genre, tone, structure) with ONE specific liked title
- "pattern": fits a pattern across SEVERAL liked titles, not just one
- "collaborative": people with similar taste to this user's also tend to like this

Hard rule: NEVER recommend something that matches the genre/tone/theme of a DISLIKED title,
even if it would otherwise be a strong pick. Filtering out known dislikes matters more than
the quality of the "why" explanation.

Respond ONLY with valid JSON, no markdown fences, no preamble. Format:
[{"title": "...", "year": 2015, "tags": ["Drama", "Thriller"], "logline": "one sentence", "why_type": "similarity", "why": "one sentence, references a specific title from history when applicable"}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!data.content) {
      return { statusCode: 502, body: JSON.stringify({ error: "Claude API error", detail: data }) };
    }

    const textBlock = data.content.find(b => b.type === "text");
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

    let recommendations;
    try {
      recommendations = JSON.parse(cleaned);
    } catch (parseErr) {
      // Response was likely truncated (hit max_tokens mid-string). Salvage
      // whatever complete entries we can rather than failing the whole request -
      // find the last complete object in the array and close it off cleanly.
      const lastCompleteEntry = cleaned.lastIndexOf("},");
      if (lastCompleteEntry === -1) {
        throw new Error("Response was truncated and no complete entries could be recovered");
      }
      const salvaged = cleaned.slice(0, lastCompleteEntry + 1) + "]";
      recommendations = JSON.parse(salvaged);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendations }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
