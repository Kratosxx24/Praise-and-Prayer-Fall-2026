// Cloudflare Worker in front of the static site.
// The SongSelect sheets (licensed lyrics) live in KV, never in this public repo,
// and are only handed to someone holding the team key from the team link.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/sheets") {
      const key = req.headers.get("x-team-key") || "";
      if (!env.TEAM_KEY || key.length !== env.TEAM_KEY.length || key !== env.TEAM_KEY) {
        return new Response("Not found", { status: 404 });
      }
      const data = await env.SHEETS.get("sheets");
      return new Response(data || "{}", {
        headers: { "content-type": "application/json", "cache-control": "private, no-store", "x-robots-tag": "noindex" },
      });
    }
    return env.ASSETS.fetch(req);
  },
};
