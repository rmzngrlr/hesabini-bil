from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Fixed Expenses UI
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Gelirler')")

    # Locate YK Income Input more specifically
    # The card title is "Yemek Kartı Geliri"
    # The input is inside that card.
    # We can use layout selector

    # Find the card with title "Yemek Kartı Geliri" and then find input inside it.
    # But Card component renders title as H3 or similar.
    # Let's find the text node and traverse up to card then down to input.

    # Or just use placeholder/label if any? No specific label inside, just title.
    # But the cards are distinct.

    # Let's try locating by index since we know the order:
    # 1. Aylık Gelir (Nakit)
    # 2. Devreden (Nakit)
    # 3. Yemek Kartı Geliri
    # 4. Yemek Kartı Devreden

    # So it should be the 3rd input of type number (index 2)
    # Be careful, there's also the "Gider Özeti" and the Add form input at bottom.

    inputs = page.locator("input[type='number']")
    # input 0 -> Aylık Gelir
    # input 1 -> Devreden
    # input 2 -> YK Gelir
    # input 3 -> YK Devreden
    # input 4 -> Tutar (Add form)

    yk_income_input = inputs.nth(2)
    yk_income_input.fill("1000")
    yk_income_input.blur()

    page.wait_for_timeout(500)

    # Go to Dashboard
    page.click("a[href='/']")
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Check "Kalan Yemek Kartı" card value
    # It should be 1000,00 ₺

    # Use text locator
    if page.is_visible("text=1.000,00 ₺"):
         print("PASS: Kalan Yemek Kartı updated correctly (found 1.000,00 ₺)")
    else:
         print("FAIL: Value not updated or not found")

    page.screenshot(path="verification/yk_budget_verify_v2.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_yk_v2.png")
        finally:
            browser.close()
