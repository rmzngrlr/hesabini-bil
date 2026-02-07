from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Theme Toggle in Dashboard Header
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Look for button in header
    # It should be near the Settings link (which is an 'a' tag)
    # They are in a flex container

    header = page.locator("header")
    toggle_btn = header.locator("button:has(svg)") # Sun/Moon icon
    settings_link = header.locator("a[href='/settings']")

    if toggle_btn.count() > 0 and settings_link.count() > 0:
        print("PASS: Theme toggle button and Settings link found in header")

        # Verify functionality again
        initial_class = page.evaluate("document.documentElement.className")
        toggle_btn.click()
        page.wait_for_timeout(500)
        new_class = page.evaluate("document.documentElement.className")

        if "dark" in new_class and "dark" not in initial_class:
             print("PASS: Toggled to Dark mode")
        elif "dark" not in new_class and "dark" in initial_class:
             print("PASS: Toggled to Light mode")
        else:
             print(f"FAIL: Theme class did not toggle correctly. Initial: {initial_class}, New: {new_class}")

    else:
        print("FAIL: Buttons not found in header")

    page.screenshot(path="verification/theme_dashboard_test.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_theme_dashboard.png")
        finally:
            browser.close()
