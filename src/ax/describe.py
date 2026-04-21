#!/usr/bin/env python3
"""
Dump the macOS accessibility tree of a running app as JSON.

Usage:
    describe.py <app-name> [max-depth]

Output: JSON on stdout. Exit non-zero on error (error message on stderr).

The accessibility tree is what VoiceOver and other a11y tech uses to
navigate UI. Crucially, it exposes elements INSIDE Electron webviews
(Claude Desktop, VS Code, Slack, Discord, etc.) that pixel-coordinate
clicks cannot reliably target — the webview renders pixels but the
underlying Chromium exposes buttons/links through AXUIElement.

Requires the mac-control process to have Accessibility permission
granted in System Settings > Privacy & Security > Accessibility.
"""

import json
import sys

try:
    from ApplicationServices import (
        AXUIElementCreateApplication,
        AXUIElementCopyAttributeValue,
        kAXErrorSuccess,
    )
    from AppKit import NSWorkspace
except ImportError:
    print(
        "ERROR: PyObjC not available. This ships with system Python 3 on macOS, "
        "but if it is missing: /usr/bin/pip3 install pyobjc-framework-ApplicationServices",
        file=sys.stderr,
    )
    sys.exit(10)


# Attributes we copy into the dump. Intentionally small — the full
# AXUIElement attribute set is huge and noisy.
DUMP_ATTRS = [
    ("AXRole", "role"),
    ("AXSubrole", "subrole"),
    ("AXRoleDescription", "roleDescription"),
    ("AXTitle", "title"),
    ("AXDescription", "description"),
    ("AXLabel", "label"),
    ("AXHelp", "help"),
    ("AXIdentifier", "identifier"),
    ("AXValue", "value"),
    ("AXEnabled", "enabled"),
    ("AXFocused", "focused"),
]


def pid_for_app(app_name: str):
    """Resolve a bundle-friendly app name to a running PID."""
    workspace = NSWorkspace.sharedWorkspace()
    for running in workspace.runningApplications():
        name = running.localizedName() or ""
        bundle = running.bundleIdentifier() or ""
        if name == app_name or bundle == app_name:
            return int(running.processIdentifier())
    # Case-insensitive fallback
    for running in workspace.runningApplications():
        name = running.localizedName() or ""
        if name.lower() == app_name.lower():
            return int(running.processIdentifier())
    return None


def get_attr(element, attr):
    try:
        err, value = AXUIElementCopyAttributeValue(element, attr, None)
    except Exception:
        return None
    if err == kAXErrorSuccess:
        return value
    return None


def safe_str(value):
    if value is None:
        return ""
    try:
        return str(value)
    except Exception:
        return ""


def describe(element, depth, max_depth):
    """Return a dict describing `element` and, recursively, its children.

    Skips uninteresting leaf nodes (no role, no title, no description)
    to keep output readable. Truncates at max_depth.
    """
    if depth > max_depth:
        return {"_truncated": True}

    info = {}
    for ax_key, out_key in DUMP_ATTRS:
        raw = get_attr(element, ax_key)
        if raw is None:
            continue
        if out_key in ("enabled", "focused"):
            info[out_key] = bool(raw)
        else:
            s = safe_str(raw).strip()
            if s:
                info[out_key] = s

    # Position + size (useful for debugging click targets)
    pos = get_attr(element, "AXPosition")
    size = get_attr(element, "AXSize")
    if pos is not None:
        try:
            # AXValue CGPoint — need to unwrap. Best-effort: stringify.
            info["position"] = safe_str(pos)
        except Exception:
            pass
    if size is not None:
        try:
            info["size"] = safe_str(size)
        except Exception:
            pass

    # Children
    children = get_attr(element, "AXChildren") or []
    if children and depth < max_depth:
        kids = []
        for child in children:
            kid = describe(child, depth + 1, max_depth)
            if kid:
                kids.append(kid)
        if kids:
            info["children"] = kids

    return info


def main():
    if len(sys.argv) < 2:
        print("Usage: describe.py <app-name> [max-depth]", file=sys.stderr)
        sys.exit(1)

    app_name = sys.argv[1]
    max_depth = int(sys.argv[2]) if len(sys.argv) > 2 else 6

    pid = pid_for_app(app_name)
    if pid is None:
        print(json.dumps({"error": f"App not running: {app_name}"}))
        sys.exit(2)

    ax_app = AXUIElementCreateApplication(pid)
    tree = describe(ax_app, 0, max_depth)
    print(json.dumps({"pid": pid, "app": app_name, "tree": tree}))


if __name__ == "__main__":
    main()
