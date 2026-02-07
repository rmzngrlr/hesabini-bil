from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Theme Toggle
    # Check current class on html
    initial_class = page.evaluate("document.documentElement.className")
    print(f"Initial class: {initial_class}")

    # Click toggle button (Sun/Moon icon)
    # It's in the top right, absolute positioned.
    # Look for button in layout
    toggle_btn = page.locator("button.absolute.top-4.right-4")
    if toggle_btn.count() > 0:
        print("PASS: Theme toggle button found")
        toggle_btn.click()
        page.wait_for_timeout(500)

        new_class = page.evaluate("document.documentElement.className")
        print(f"New class: {new_class}")

        if "dark" in new_class and "dark" not in initial_class:
             print("PASS: Toggled to Dark mode")
        elif "dark" not in new_class and "dark" in initial_class:
             print("PASS: Toggled to Light mode")
        else:
             print("FAIL: Theme class did not toggle correctly")
    else:
        print("FAIL: Theme toggle button not found")

    page.screenshot(path="verification/theme_test.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_theme.png")
        finally:
            browser.close()
