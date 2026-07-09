import argparse
import os
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


def parse_args():
    parser = argparse.ArgumentParser(description="Run a small Playwright smoke test for the inventory webapp.")
    parser.add_argument("--base-url", default=os.getenv("WEBAPP_TEST_BASE_URL", "http://127.0.0.1:3000"))
    parser.add_argument("--username", default=os.getenv("WEBAPP_TEST_USERNAME", "kasir"))
    parser.add_argument("--password", default=os.getenv("WEBAPP_TEST_PASSWORD", "password"))
    parser.add_argument("--no-server", action="store_true", help="Do not start npm dev server automatically.")
    parser.add_argument(
        "--server-command",
        default=os.getenv("WEBAPP_TEST_SERVER_COMMAND", "npm run dev -- -H 127.0.0.1 -p 3000"),
        help="Command used when the target port is not already listening.",
    )
    parser.add_argument("--timeout", type=int, default=60, help="Seconds to wait for the server.")
    return parser.parse_args()


def is_port_open(host, port):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def wait_for_server(host, port, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_port_open(host, port):
            return True
        time.sleep(0.5)
    return False


def start_server_if_needed(args):
    parsed = urlparse(args.base_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if is_port_open(host, port):
        return None
    if args.no_server:
        raise RuntimeError(f"Server is not listening at {host}:{port}. Start it first or remove --no-server.")

    print(f"Starting server: {args.server_command}", flush=True)
    process = subprocess.Popen(
        args.server_command,
        cwd=os.getcwd(),
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not wait_for_server(host, port, args.timeout):
        process.terminate()
        raise RuntimeError(f"Server did not become ready at {host}:{port} within {args.timeout}s.")
    return process


def run_smoke(args):
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        page.goto(f"{args.base_url}/login", wait_until="networkidle")
        page.locator("#username").fill(args.username)
        page.locator("#password").fill(args.password)
        page.get_by_role("button", name="Masuk ke Sistem").click()

        try:
            page.wait_for_url(lambda url: "/login" not in url, timeout=15000)
        except PlaywrightTimeoutError as exc:
            login_error = page.locator("text=Username atau password salah").count() > 0
            body_text = page.locator("body").inner_text(timeout=1000)[:500]
            hint = (
                " Login failed; set WEBAPP_TEST_USERNAME and WEBAPP_TEST_PASSWORD for this database."
                if login_error
                else f" Page stayed on login. Visible text starts with: {body_text!r}"
            )
            raise AssertionError(f"Login did not leave /login.{hint}") from exc

        page.wait_for_load_state("networkidle")
        page.locator('[data-testid="sidebar-logout-button"]').click()
        page.locator('[data-testid="logout-confirm-button"]').click()
        page.wait_for_url(lambda url: url.endswith("/login"), timeout=15000)

        browser.close()

    if errors:
        raise AssertionError("Console errors were emitted:\n" + "\n".join(errors[:10]))


def main():
    args = parse_args()
    server = None
    try:
        server = start_server_if_needed(args)
        run_smoke(args)
        print("webapp smoke test passed")
    except (AssertionError, RuntimeError, PlaywrightError) as exc:
        print(f"webapp smoke test failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if server and server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
