from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Fixed Expenses UI
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Gelirler')")

    # Use a simpler selector strategy.
    # Find the card by text "Yemek Kartı Geliri"
    # Then traverse to its input.

    # The Card component renders:
    # <div className="...">
    #   <div className="flex flex-col space-y-1.5 p-6">
    #     <h3 className="font-semibold leading-none tracking-tight">Title</h3>
    #   </div>
    #   <div className="p-6 pt-0">
    #     {children}
    #   </div>
    # </div>

    # We can select by text "Yemek Kartı Geliri" which is the H3.
    # Then go up to the card, then down to input.

    card = page.locator("div.rounded-xl:has(h3:has-text('Yemek Kartı Geliri'))")
    input_locator = card.locator("input[type='number']")

    input_locator.fill("1000")
    input_locator.blur()

    page.wait_for_timeout(500)

    # Go to Dashboard
    page.click("a[href='/']")
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Check "Kalan Yemek Kartı" card value
    result_card = page.locator("div.rounded-xl:has(h3:has-text('Kalan Yemek Kartı'))")
    value_locator = result_card.locator("div.text-3xl")

    # Wait for value
    value_locator.wait_for()
    value_text = value_locator.text_content().strip()

    print(f"Result Value: {value_text}")

    # We expect 1.000,00 but minus any previous expenses (50 from previous tests if persisted)
    if "1.000,00" in value_text or "950,00" in value_text:
        print("PASS: Verified YK Budget Logic")
    else:
        print(f"FAIL: Value mismatch. Expected ~1000, got {value_text}")

    page.screenshot(path="verification/yk_budget_final.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_yk_final.png")
        finally:
            browser.close()
