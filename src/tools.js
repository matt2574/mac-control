// Tool registry — defines all available macOS tools, their metadata, and parameter schemas.

const tools = [
  {
    name: "get_system_info",
    description: "Get macOS system information including hostname, platform, CPU, memory, and uptime",
    category: "system",
    securityLevel: "safe",
    parameters: {},
    returns: "Object with hostname, platform, arch, cpuModel, cpuCores, totalMemoryGB, freeMemoryGB, uptimeHours",
    example: '{ "tool": "get_system_info", "parameters": {} }',
    requiresPermission: "none",
  },
  {
    name: "take_screenshot",
    description: "Capture a screenshot of the current display and save it to a temporary file",
    category: "display",
    securityLevel: "standard",
    parameters: {
      display: {
        type: "string",
        description: "Which display to capture (default: 'main')",
        default: "main",
      },
    },
    returns: "Object with path to the saved screenshot file",
    example: '{ "tool": "take_screenshot", "parameters": { "display": "main" } }',
    requiresPermission: "screen-capture",
  },
  {
    name: "open_url",
    description: "Open a URL in the default browser",
    category: "browser",
    securityLevel: "standard",
    parameters: {
      url: {
        type: "string",
        description: "The URL to open",
        required: true,
      },
    },
    returns: "Object with success status",
    example: '{ "tool": "open_url", "parameters": { "url": "https://example.com" } }',
    requiresPermission: "none",
  },
  {
    name: "focus_app",
    description: "Bring a running application to the foreground",
    category: "apps",
    securityLevel: "standard",
    parameters: {
      app: {
        type: "string",
        description: "The application name to focus (e.g. 'Safari', 'Google Chrome')",
        required: true,
      },
    },
    returns: "Object with success status",
    example: '{ "tool": "focus_app", "parameters": { "app": "Safari" } }',
    requiresPermission: "accessibility",
  },
  {
    name: "keypress",
    description: "Simulate keyboard key presses or shortcuts (e.g. ['cmd', 'r'] for Cmd+R)",
    category: "input",
    securityLevel: "elevated",
    parameters: {
      keys: {
        type: "array",
        items: { type: "string" },
        description: "Array of key names to press simultaneously. Modifiers: cmd, alt, ctrl, shift. Keys: return, tab, escape, space, delete, up, down, left, right, or any single character.",
        required: true,
      },
    },
    returns: "Object with success status",
    example: '{ "tool": "keypress", "parameters": { "keys": ["cmd", "r"] } }',
    requiresPermission: "accessibility",
  },
  {
    name: "click",
    description: "Simulate a mouse click at specific screen coordinates",
    category: "input",
    securityLevel: "elevated",
    parameters: {
      x: {
        type: "number",
        description: "X coordinate on screen",
        required: true,
      },
      y: {
        type: "number",
        description: "Y coordinate on screen",
        required: true,
      },
    },
    returns: "Object with success status",
    example: '{ "tool": "click", "parameters": { "x": 500, "y": 300 } }',
    requiresPermission: "accessibility",
  },
  {
    name: "ax_describe_ui",
    description: "Dump the accessibility tree of a running app as JSON. Works inside Electron webviews (Claude Desktop, VS Code, etc.) where coordinate clicks fail.",
    category: "accessibility",
    securityLevel: "standard",
    parameters: {
      app: {
        type: "string",
        description: "Application name (e.g. 'Claude', 'Safari')",
        required: true,
      },
      depth: {
        type: "number",
        description: "Max tree depth (default: 6)",
        default: 6,
      },
      roles: {
        type: "string",
        description: "Comma-separated AX role filter (e.g. 'AXButton,AXTextField')",
      },
    },
    returns: "JSON accessibility tree with role, title, description, frame, pressable for each element",
    example: '{ "tool": "ax_describe_ui", "parameters": { "app": "Claude", "depth": 4 } }',
    requiresPermission: "accessibility",
  },
  {
    name: "ax_click_element",
    description: "Click (AXPress) an element in a running app matched by accessibility role/title/description. Works inside Electron webviews where coordinate clicks fail.",
    category: "accessibility",
    securityLevel: "elevated",
    parameters: {
      app: {
        type: "string",
        description: "Application name (e.g. 'Claude')",
        required: true,
      },
      role: {
        type: "string",
        description: "AX role to match (e.g. 'AXButton', 'AXTextField')",
      },
      title: {
        type: "string",
        description: "Title substring to match",
      },
      description: {
        type: "string",
        description: "Description substring to match",
      },
      index: {
        type: "number",
        description: "Which match to click if multiple found (0-based, default: 0)",
        default: 0,
      },
      dryRun: {
        type: "boolean",
        description: "If true, find the element but don't click it",
        default: false,
      },
    },
    returns: "Object with matched element info and click result",
    example: '{ "tool": "ax_click_element", "parameters": { "app": "Claude", "role": "AXButton", "title": "New session" } }',
    requiresPermission: "accessibility",
  },
];

const categories = {
  system: {
    name: "System",
    description: "System information and diagnostics",
    icon: "💻",
  },
  display: {
    name: "Display",
    description: "Screen capture and display operations",
    icon: "🖥️",
  },
  browser: {
    name: "Browser",
    description: "Browser and URL operations",
    icon: "🌐",
  },
  apps: {
    name: "Applications",
    description: "Application management and focus",
    icon: "📱",
  },
  input: {
    name: "Input",
    description: "Keyboard and mouse input simulation",
    icon: "⌨️",
  },
  accessibility: {
    name: "Accessibility",
    description: "AX-based UI inspection and interaction (works inside Electron webviews)",
    icon: "♿",
  },
};

// Security presets determine which tools are available
const securityPresets = {
  safe: ["get_system_info"],
  standard: ["get_system_info", "take_screenshot", "open_url", "focus_app"],
  full: ["get_system_info", "take_screenshot", "open_url", "focus_app", "keypress", "click", "ax_describe_ui", "ax_click_element"],
};

module.exports = { tools, categories, securityPresets };
