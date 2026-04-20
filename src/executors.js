// Tool executors — each function implements a macOS tool using native commands.

const { execSync, exec } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

function getSystemInfo() {
  return {
    success: true,
    result: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      osVersion: execSync("sw_vers -productVersion", { encoding: "utf8" }).trim(),
      cpuModel: os.cpus()[0]?.model || "unknown",
      cpuCores: os.cpus().length,
      totalMemoryGB: Math.round((os.totalmem() / 1073741824) * 100) / 100,
      freeMemoryGB: Math.round((os.freemem() / 1073741824) * 100) / 100,
      uptimeHours: Math.round((os.uptime() / 3600) * 100) / 100,
    },
  };
}

function takeScreenshot(params) {
  const tmpDir = os.tmpdir();
  const filename = `mac-control-screenshot-${Date.now()}.png`;
  const filepath = path.join(tmpDir, filename);

  try {
    execSync(`screencapture -x ${filepath}`, { timeout: 10000 });
    if (!fs.existsSync(filepath)) {
      return { success: false, error: "Screenshot file was not created" };
    }
    return { success: true, result: { path: filepath } };
  } catch (err) {
    return { success: false, error: `Screenshot failed: ${err.message}` };
  }
}

function openUrl(params) {
  const { url } = params;
  if (!url || typeof url !== "string") {
    return { success: false, error: "Missing required parameter: url" };
  }
  // Validate URL format to prevent command injection
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { success: false, error: "Only http and https URLs are allowed" };
    }
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  try {
    execSync(`open ${JSON.stringify(url)}`, { timeout: 5000 });
    return { success: true, result: { opened: url } };
  } catch (err) {
    return { success: false, error: `Failed to open URL: ${err.message}` };
  }
}

function focusApp(params) {
  const { app } = params;
  if (!app || typeof app !== "string") {
    return { success: false, error: "Missing required parameter: app" };
  }
  // Sanitize app name — only allow alphanumeric, spaces, and common punctuation
  if (!/^[\w\s.\-()]+$/.test(app)) {
    return { success: false, error: "Invalid application name" };
  }

  try {
    execSync(
      `osascript -e 'tell application "${app}" to activate'`,
      { timeout: 5000 }
    );
    return { success: true, result: { focused: app } };
  } catch (err) {
    return { success: false, error: `Failed to focus app: ${err.message}` };
  }
}

// Map key names to AppleScript key codes / key names
const KEY_MAP = {
  cmd: "command",
  command: "command",
  alt: "option",
  option: "option",
  ctrl: "control",
  control: "control",
  shift: "shift",
  return: "return",
  enter: "return",
  tab: "tab",
  escape: "escape",
  space: "space",
  delete: "delete",
  up: "up arrow",
  down: "down arrow",
  left: "left arrow",
  right: "right arrow",
};

const MODIFIERS = new Set(["command", "option", "control", "shift"]);

function keypress(params) {
  const { keys } = params;
  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return { success: false, error: "Missing required parameter: keys (array of key names)" };
  }

  // Validate all keys to prevent injection
  for (const key of keys) {
    if (typeof key !== "string" || key.length > 20) {
      return { success: false, error: `Invalid key: ${key}` };
    }
    if (!/^[\w\s]+$/.test(key)) {
      return { success: false, error: `Invalid key characters: ${key}` };
    }
  }

  const modifiers = [];
  let mainKey = null;

  for (const key of keys) {
    const mapped = KEY_MAP[key.toLowerCase()] || key.toLowerCase();
    if (MODIFIERS.has(mapped)) {
      modifiers.push(mapped);
    } else {
      mainKey = mapped;
    }
  }

  if (!mainKey && modifiers.length === 0) {
    return { success: false, error: "No valid keys provided" };
  }

  try {
    let script;
    if (mainKey && modifiers.length > 0) {
      const modStr = modifiers.map((m) => `${m} down`).join(", ");
      if (mainKey.length === 1) {
        script = `tell application "System Events" to keystroke "${mainKey}" using {${modStr}}`;
      } else {
        script = `tell application "System Events" to key code (key code of "${mainKey}") using {${modStr}}`;
        // For named keys, use a different approach
        script = `tell application "System Events" to keystroke (key code 0) using {${modStr}}`;
        // Actually, let's use the proper approach for special keys
        script = `tell application "System Events"\nkey down {${modifiers.join(", ")}}\nkeystroke "${mainKey}"\nkey up {${modifiers.join(", ")}}\nend tell`;
        // Simplify: for named keys with modifiers, use keystroke for single chars and key code for special
        if (["return", "tab", "escape", "space", "delete", "up arrow", "down arrow", "left arrow", "right arrow"].includes(mainKey)) {
          const keyCodeMap = {
            "return": 36, "tab": 48, "escape": 53, "space": 49,
            "delete": 51, "up arrow": 126, "down arrow": 125,
            "left arrow": 123, "right arrow": 124,
          };
          const code = keyCodeMap[mainKey];
          script = `tell application "System Events" to key code ${code} using {${modStr}}`;
        } else {
          script = `tell application "System Events" to keystroke "${mainKey}" using {${modStr}}`;
        }
      }
    } else if (mainKey) {
      if (["return", "tab", "escape", "space", "delete", "up arrow", "down arrow", "left arrow", "right arrow"].includes(mainKey)) {
        const keyCodeMap = {
          "return": 36, "tab": 48, "escape": 53, "space": 49,
          "delete": 51, "up arrow": 126, "down arrow": 125,
          "left arrow": 123, "right arrow": 124,
        };
        const code = keyCodeMap[mainKey];
        script = `tell application "System Events" to key code ${code}`;
      } else {
        script = `tell application "System Events" to keystroke "${mainKey}"`;
      }
    } else {
      return { success: false, error: "No main key provided, only modifiers" };
    }

    execSync(`osascript -e '${script}'`, { timeout: 5000 });
    return { success: true, result: { pressed: keys } };
  } catch (err) {
    return { success: false, error: `Keypress failed: ${err.message}` };
  }
}

function click(params) {
  const { x, y } = params;
  if (typeof x !== "number" || typeof y !== "number") {
    return { success: false, error: "Missing required parameters: x (number), y (number)" };
  }
  if (x < 0 || y < 0 || x > 10000 || y > 10000) {
    return { success: false, error: "Coordinates out of reasonable range (0-10000)" };
  }

  try {
    // Use cliclick if available, otherwise fall back to AppleScript
    try {
      execSync("which cliclick", { encoding: "utf8" });
      execSync(`cliclick c:${Math.round(x)},${Math.round(y)}`, { timeout: 5000 });
    } catch {
      // Fallback: use AppleScript + Python for mouse click
      const script = `
do shell script "python3 -c \\"
import Quartz
event = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (${x}, ${y}), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
event = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (${x}, ${y}), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
\\""`;
      execSync(`osascript -e '${script}'`, { timeout: 5000 });
    }
    return { success: true, result: { clicked: { x, y } } };
  } catch (err) {
    return { success: false, error: `Click failed: ${err.message}` };
  }
}

const executors = {
  get_system_info: getSystemInfo,
  take_screenshot: takeScreenshot,
  open_url: openUrl,
  focus_app: focusApp,
  keypress: keypress,
  click: click,
};

module.exports = { executors };
