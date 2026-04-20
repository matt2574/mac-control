# mac-control

Standalone local macOS control service for [tru-tech_os](https://github.com/matt2574/tru-tech_os). Runs on the Mac mini and exposes an HTTP API that tru-tech_os calls to interact with the local desktop — take screenshots, open URLs, focus apps, simulate input, etc.

This service exists separately from the main Vercel app because it needs direct access to macOS APIs (screen capture, AppleScript, accessibility) that can only run locally.

## Quick start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env to set MAC_CONTROL_SECRET (must match tru-tech_os)

# Start the service
npm start
# → http://localhost:9999

# Or with auto-reload during development
npm run dev
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `9999` | Port to listen on |
| `MAC_CONTROL_SECRET` | `dev-secret-change-me` | Bearer token for protected endpoints |

## API Endpoints

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ status: "ok" }` |
| `GET` | `/tools` | List enabled tools (name + description) |
| `GET` | `/tools/registry` | Full tool definitions with parameters |
| `GET` | `/categories` | Tool category metadata |
| `GET` | `/settings` | Current security preset and enabled tools |

### Protected (requires `Authorization: Bearer <MAC_CONTROL_SECRET>`)

| Method | Path | Description |
|---|---|---|
| `PUT` | `/settings` | Update security preset / enabled tools |
| `POST` | `/execute` | Execute a tool |

### Execute request format

```json
{
  "tool": "open_url",
  "parameters": { "url": "https://example.com" }
}
```

Or spread-style (also supported):

```json
{
  "tool": "focus_app",
  "app": "Safari"
}
```

## Available tools

| Tool | Security level | Description |
|---|---|---|
| `get_system_info` | safe | Hostname, CPU, memory, uptime |
| `take_screenshot` | standard | Capture display to temp file |
| `open_url` | standard | Open URL in default browser |
| `focus_app` | standard | Bring app to foreground |
| `keypress` | elevated | Simulate keyboard shortcuts |
| `click` | elevated | Mouse click at coordinates |

## Security presets

- **safe** — read-only (system info only)
- **standard** (default) — common operations (screenshots, open URL, focus app)
- **full** — all tools including input simulation

## Connecting tru-tech_os

In your tru-tech_os `.env.local`, set:

```
MAC_CONTROL_URL=http://localhost:9999
MAC_CONTROL_SECRET=<your-shared-secret>
```

Then enable "Mac Control" in tru-tech_os Settings. The app will call this service's endpoints directly.

## macOS permissions

Some tools require macOS permissions:

- **Screen capture**: System Settings → Privacy & Security → Screen Recording → enable your terminal / Node
- **Accessibility** (keypress, click, focus_app): System Settings → Privacy & Security → Accessibility → enable your terminal / Node

## Running as a background service (optional)

To keep mac-control running after logout, you can create a LaunchAgent:

```bash
cat > ~/Library/LaunchAgents/com.mac-control.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mac-control</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/mattschmidt/Apps/mac-control/src/server.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MAC_CONTROL_SECRET</key>
    <string>your-secret-here</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/mac-control.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/mac-control.err</string>
</dict>
</plist>
PLIST

launchctl load ~/Library/LaunchAgents/com.mac-control.plist
```

Adjust the node path (`which node`) and secret as needed.
