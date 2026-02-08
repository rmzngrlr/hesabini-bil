from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")
    page.wait_for_selector("nav")
    # Screenshot the navbar area
    nav = page.locator("nav")
    nav.screenshot(path="verification/navbar_icon_change.png")
    print("Navbar screenshot captured.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
