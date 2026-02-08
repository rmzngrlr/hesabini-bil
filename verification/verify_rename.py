from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # Check Header
    header = page.locator("h1:has-text('Hesabını Bil!')")
    if header.count() > 0:
        print("PASS: Header text 'Hesabını Bil!' found.")
    else:
        print("FAIL: Header text 'Hesabını Bil!' NOT found.")

    # Check Page Title
    title = page.title()
    print(f"Page Title: {title}")
    if "Hesabını Bil!" in title:
        print("PASS: Page title is correct.")
    else:
        print("FAIL: Page title is incorrect.")

    page.screenshot(path="verification/app_rename.png")

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
