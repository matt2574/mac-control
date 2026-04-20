const express = require("express");
const { tools, categories, securityPresets } = require("./tools");
const { executors } = require("./executors");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 9999;
const SECRET = process.env.MAC_CONTROL_SECRET || "dev-secret-change-me";

// --- In-memory settings ---
let settings = {
  securityPreset: "standard",
  enabledTools: null, // null means use preset defaults
  customActions: [],
};

// --- Helpers ---

function getEnabledToolNames() {
  if (settings.enabledTools) return settings.enabledTools;
  return securityPresets[settings.securityPreset] || securityPresets.standard;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// --- Routes ---

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// List tools — names and descriptions (no auth)
app.get("/tools", (_req, res) => {
  const enabled = getEnabledToolNames();
  const list = tools
    .filter((t) => enabled.includes(t.name))
    .map((t) => ({ name: t.name, description: t.description }));
  res.json({ tools: list });
});

// Full tool registry (no auth)
app.get("/tools/registry", (_req, res) => {
  const enabled = getEnabledToolNames();
  const list = tools.filter((t) => enabled.includes(t.name));
  res.json({ tools: list });
});

// Categories (no auth)
app.get("/categories", (_req, res) => {
  res.json(categories);
});

// Get settings (no auth)
app.get("/settings", (_req, res) => {
  res.json(settings);
});

// Update settings (auth required)
app.put("/settings", requireAuth, (req, res) => {
  const { securityPreset, enabledTools, customActions } = req.body;
  if (securityPreset && ["safe", "standard", "full"].includes(securityPreset)) {
    settings.securityPreset = securityPreset;
  }
  if (enabledTools !== undefined) {
    settings.enabledTools = enabledTools;
  }
  if (customActions !== undefined) {
    settings.customActions = customActions;
  }
  res.json(settings);
});

// Execute a tool (auth required)
app.post("/execute", requireAuth, (req, res) => {
  const { tool, parameters, ...rest } = req.body;

  if (!tool || typeof tool !== "string") {
    return res.status(400).json({ success: false, error: "Missing required field: tool" });
  }

  // Merge parameters: support both { parameters: {...} } and spread-style
  const params = { ...rest, ...parameters };

  // Check tool exists
  const toolDef = tools.find((t) => t.name === tool);
  if (!toolDef) {
    return res.status(404).json({ success: false, error: `Unknown tool: ${tool}` });
  }

  // Check tool is enabled
  const enabled = getEnabledToolNames();
  if (!enabled.includes(tool)) {
    return res.status(403).json({
      success: false,
      error: `Tool "${tool}" is not enabled under the current security preset (${settings.securityPreset})`,
    });
  }

  // Execute
  const executor = executors[tool];
  if (!executor) {
    return res.status(500).json({ success: false, error: `No executor found for tool: ${tool}` });
  }

  try {
    const result = executor(params);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`mac-control service running on http://localhost:${PORT}`);
  console.log(`Security preset: ${settings.securityPreset}`);
  console.log(`Auth secret: ${SECRET === "dev-secret-change-me" ? "(default — set MAC_CONTROL_SECRET)" : "(configured)"}`);
});
