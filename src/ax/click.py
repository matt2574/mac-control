#!/usr/bin/env python3
"""
Click (or perform a named action on) an element in a running app, matched
by accessibility attributes — NOT pixel coordinates.

Usage:
    click.py '<json-query>'

Where <json-query> is an object with:
    app          (required)  App name or bundle id
    title        (optional)  AXTitle equality
    titleContains(optional)  AXTitle substring match
    role         (optional)  AXRole equality (e.g. "AXButton")
    description  (optional)  AXDescription equality
    descriptionContains (optional) AXDescription substring
    identifier   (optional)  AXIdentifier equality
    index        (optional)  Which match to hit if multiple (default 0)
    action       (optional)  AX action name (default "AXPress")
    maxDepth     (optional)  How deep to search (default 25)
    dryRun       (optional)  If true, just report matches without acting

Why this exists:
    Coordinate clicks (cliclick c:X,Y or Quartz CGEvent) don't reliably
    hit buttons inside Electron webviews (Claude Code Desktop, Slack,
    VS Code, etc.) because the webview container owns those pixels at
    the OS level — the click lands but doesn't reach the DOM.
    AXPress on an AXUIElement bypasses the coordinate layer entirely.
"""

import json
import sys

try:
    from ApplicationServices import (
        AXUIElementCreateApplication,
        AXUIElementCopyAttributeValue,
        AXUIElementPerformAction,
        kAXErrorSuccess,
    )
    from AppKit import NSWorkspace
except ImportError:
    print(
        json.dumps({"error": "PyObjC not available"}),
        file=sys.stderr,
    )
    sys.exit(10)


def pid_for_app(app_name):
    workspace = NSWorkspace.sharedWorkspace()
    for running in workspace.runningApplications():
        name = running.localizedName() or ""
        bundle = running.bundleIdentifier() or ""
        if name == app_name or bundle == app_name:
            return int(running.processIdentifier())
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
        return str(value).strip()
    except Exception:
        return ""


def matches(element, q):
    title = q.get("title")
    title_contains = q.get("titleContains")
    role = q.get("role")
    description = q.get("description")
    description_contains = q.get("descriptionContains")
    identifier = q.get("identifier")

    if title is not None and safe_str(get_attr(element, "AXTitle")) != title:
        return False
    if title_contains is not None and title_contains not in safe_str(get_attr(element, "AXTitle")):
        return False
    if role is not None and safe_str(get_attr(element, "AXRole")) != role:
        return False
    if description is not None and safe_str(get_attr(element, "AXDescription")) != description:
        return False
    if description_contains is not None and description_contains not in safe_str(get_attr(element, "AXDescription")):
        return False
    if identifier is not None and safe_str(get_attr(element, "AXIdentifier")) != identifier:
        return False

    # Must have specified at least one predicate — otherwise we'd match every node.
    if all(
        v is None
        for v in (title, title_contains, role, description, description_contains, identifier)
    ):
        return False

    return True


def find_all(element, q, depth, max_depth, out):
    if depth > max_depth:
        return
    if matches(element, q):
        out.append(element)
    children = get_attr(element, "AXChildren") or []
    for child in children:
        find_all(child, q, depth + 1, max_depth, out)


def describe_brief(element):
    return {
        "role": safe_str(get_attr(element, "AXRole")),
        "title": safe_str(get_attr(element, "AXTitle")),
        "description": safe_str(get_attr(element, "AXDescription")),
        "identifier": safe_str(get_attr(element, "AXIdentifier")),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: click.py <json-query>"}), file=sys.stderr)
        sys.exit(1)

    try:
        q = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON query: {e}"}), file=sys.stderr)
        sys.exit(1)

    app_name = q.get("app")
    if not app_name:
        print(json.dumps({"error": "Missing 'app' in query"}), file=sys.stderr)
        sys.exit(1)

    max_depth = int(q.get("maxDepth", 25))
    index = int(q.get("index", 0))
    action = q.get("action", "AXPress")
    dry_run = bool(q.get("dryRun", False))

    pid = pid_for_app(app_name)
    if pid is None:
        print(json.dumps({"error": f"App not running: {app_name}"}))
        sys.exit(2)

    ax_app = AXUIElementCreateApplication(pid)

    results = []
    find_all(ax_app, q, 0, max_depth, results)

    if not results:
        print(json.dumps({"error": "No matching element found", "query": q, "matches": 0}))
        sys.exit(3)

    # Report matches in dry-run mode
    if dry_run:
        print(json.dumps({
            "success": True,
            "dryRun": True,
            "matches": len(results),
            "elements": [describe_brief(e) for e in results[:10]],
        }))
        return

    if index >= len(results):
        print(json.dumps({
            "error": f"Only {len(results)} matches, index {index} out of range",
            "matches": len(results),
            "elements": [describe_brief(e) for e in results[:10]],
        }))
        sys.exit(4)

    element = results[index]
    err = AXUIElementPerformAction(element, action)
    if err != kAXErrorSuccess:
        print(json.dumps({
            "error": f"AXPerformAction failed with code {err}",
            "action": action,
            "element": describe_brief(element),
        }))
        sys.exit(5)

    print(json.dumps({
        "success": True,
        "matches": len(results),
        "index": index,
        "action": action,
        "element": describe_brief(element),
    }))


if __name__ == "__main__":
    main()
