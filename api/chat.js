export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

  try {
    const { messages, temperature = 0.7, webSearch = false, translateTo } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ error: { message: "No messages" } });

    let systemPrompt = messages.find(m => m.role === "system")?.content || "";
    let history = messages.filter(m => m.role !== "system").slice(-14);

    // ── TRANSLATE MODE ──
    if (translateTo) {
      const lastUser = [...history].reverse().find(m => m.role === "user");
      if (lastUser) {
        systemPrompt =
          `You are a professional translator. Translate the following text to: ${translateTo}. ` +
          `Return ONLY the translation. No explanations, no quotes, nothing else.`;
        history = [{ role: "user", content: typeof lastUser.content === "string" ? lastUser.content : "" }];
      }
    }

    // ── WEB SEARCH via Tavily ──
    if (webSearch && !translateTo && process.env.TAVILY_API_KEY) {
      const lastUser = [...history].reverse().find(m => m.role === "user");
      const query = (typeof lastUser?.content === "string" ? lastUser.content : "").slice(0, 400);
      if (query) {
        try {
          const tavRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query,
              search_depth: "basic",
              max_results: 5,
              include_answer: true,
            }),
          });
          if (tavRes.ok) {
            const tav = await tavRes.json();
            const snippets = (tav.results || []).slice(0, 5)
              .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.content || "").slice(0, 500)}`)
              .join("\n\n");
            const answer = tav.answer ? `Quick answer: ${tav.answer}\n\n` : "";
            systemPrompt +=
              `\n\n--- WEB SEARCH RESULTS (${new Date().toLocaleDateString()}) ---\n` +
              answer + snippets +
              `\n--- END SEARCH ---\n` +
              `Use these results in your answer. Cite sources as [1], [2], etc.`;
          }
        } catch (_) {}
      }
    }

    // ── BUILD MESSAGES ──
    const apiMessages = [];
    if (systemPrompt) apiMessages.push({ role: "system", content: systemPrompt });

    for (const m of history) {
      const role = m.role === "assistant" ? "assistant" : "user";
      apiMessages.push({ role, content: String(m.content || "").slice(0, 6000) });
    }

    if (!apiMessages.filter(m => m.role !== "system").length)
      return res.status(400).json({ error: { message: "No user messages" } });

    const lastNonSystem = [...apiMessages].reverse().find(m => m.role !== "system");
    if (!lastNonSystem || lastNonSystem.role !== "user")
      return res.status(400).json({ error: { message: "Last message must be from user" } });

    // GROQ API - llama-3.3-70b
    const model = "llama-3.3-70b-versatile";

    const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: Math.min(Math.max(parseFloat(temperature) || 0.7, 0), 2),
        max_tokens: 8192,
        stream: true,
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      return res.status(apiRes.status).json({
        error: { message: err?.message || err?.error?.message || "Groq API error" }
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const text = json.choices?.[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch {}
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: { message: err.message || "Server error" } });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}
