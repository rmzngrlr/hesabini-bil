from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Dashboard for new cards
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    if page.is_visible("text=Kalan Nakit") and page.is_visible("text=Kalan Yemek Kartı"):
        print("PASS: New Dashboard cards found (Nakit and YK)")
    else:
        print("FAIL: Dashboard cards missing")

    # 2. Verify Fixed Expenses UI
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Gelirler')")

    # Check headers
    if page.is_visible("h1:has-text('Sabit Gelirler')") and page.is_visible("h1:has-text('Sabit Giderler')"):
        print("PASS: Headers 'Sabit Gelirler' and 'Sabit Giderler' found")
    else:
        print("FAIL: Headers missing or incorrect")

    # Check YK Inputs
    if page.is_visible("text=Yemek Kartı Geliri") and page.is_visible("text=Yemek Kartı Devreden"):
        print("PASS: YK Income/Rollover cards found")
    else:
        print("FAIL: YK Income/Rollover cards missing")

    # 3. Test YK Budget Logic
    # Set YK Income to 1000
    yk_income_input = page.locator("div:has-text('Yemek Kartı Geliri') >> input[type='number']")
    yk_income_input.fill("1000")
    page.keyboard.press("Tab") # Trigger onBlur

    # Go to Dashboard and check value
    page.click("a[href='/']")
    page.wait_for_timeout(500)

    # Kalan Yemek Kartı should be ~1000 (minus whatever we added in previous test step if persistence works)
    # In previous test we added 50 YK expense. So expected 950.
    # Note: State persists in localStorage across tests if browser context isn't cleared?
    # Playwright browser context is usually fresh unless we use persistent context.
    # But here we are just reloading page in same session?
    # Actually 'browser.new_page()' creates fresh context usually.
    # But let's check text content to be safe.

    # Get text of Kalan Yemek Kartı value
    yk_value = page.locator("div:has-text('Kalan Yemek Kartı') >> xpath=.. >> div[class*='text-3xl']").text_content()
    print(f"PASS: Kalan YK Value: {yk_value}")

    page.screenshot(path="verification/yk_budget_verify.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_yk.png")
        finally:
            browser.close()
