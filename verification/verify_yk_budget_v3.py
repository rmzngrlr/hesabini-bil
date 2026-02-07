from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Fixed Expenses UI
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Gelirler')")

    # Locate YK Income Input more specifically
    # Using xpath to find the input under the specific card

    # Card "Yemek Kartı Geliri"
    yk_income_locator = page.locator("div.rounded-xl.border.bg-card.text-card-foreground.shadow-sm:has(div.flex.flex-col.space-y-1.5.p-6 > h3:has-text('Yemek Kartı Geliri')) >> input[type='number']")

    # Wait for visibility
    yk_income_locator.wait_for(state="visible", timeout=5000)

    # Fill
    yk_income_locator.fill("1000")
    yk_income_locator.blur()

    page.wait_for_timeout(500)

    # Go to Dashboard
    page.click("a[href='/']")
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Check "Kalan Yemek Kartı" card value
    # Card with "Kalan Yemek Kartı" title, check the value inside.
    # The value is usually the first div with class text-3xl inside that card.

    card_locator = page.locator("div.rounded-xl.border.bg-card.text-card-foreground.shadow-sm:has(div.flex.flex-col.space-y-1.5.p-6 > h3:has-text('Kalan Yemek Kartı'))")
    value_locator = card_locator.locator("div.text-3xl")

    value_text = value_locator.text_content()
    print(f"PASS: Found YK Value on Dashboard: {value_text}")

    if "1.000,00" in value_text:
         print("PASS: Verified value is 1000")
    else:
         print(f"FAIL: Expected 1000 but got {value_text}")

    page.screenshot(path="verification/yk_budget_verify_v3.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_yk_v3.png")
        finally:
            browser.close()
