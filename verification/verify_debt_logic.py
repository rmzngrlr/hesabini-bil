from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Add Debt
    page.click("a[href='/debt']")
    page.wait_for_selector("h1:has-text('Kredi Kartı Borçları')")

    # Check Toggle
    if page.is_visible("button:has-text('Harcama (Borç)')") and page.is_visible("button:has-text('Ödeme (Yatırma)')"):
        print("PASS: Debt/Payment Toggle found")
    else:
        print("FAIL: Debt/Payment Toggle not found")

    # Add Spending (Negative)
    # Default is Harcama
    page.fill("input[placeholder='Örn: Telefon, Market']", "Groceries")
    page.fill("input[placeholder='0.00']", "500")
    page.click("button:has-text('Ekle')")

    # Check List
    page.wait_for_timeout(500)
    # Amount should be negative logic but formatted?
    # Our code: {debt.amount.toLocaleString(...)}
    # If negative: "-500,00 TL" (or similar)
    # Color: red-500

    # Text locator might find "-500,00".
    # Let's check text content of the amount.

    debt_item = page.locator("div.flex.items-center.justify-between:has-text('Groceries')")
    amount_div = debt_item.locator("div.font-bold")
    amount_text = amount_div.text_content()

    print(f"Spending Amount Text: {amount_text}")
    # We formatted it manually: {debt.amount > 0 ? '+' : ''}{debt.amount...}
    # If -500, it shows "-500,00 ₺"

    if "-" in amount_text and "500" in amount_text:
        print("PASS: Spending added as negative")
    else:
        print("FAIL: Spending not displayed as negative")

    # Check class for color (text-red-500)
    classes = amount_div.get_attribute("class")
    if "text-red-500" in classes:
        print("PASS: Spending is red")
    else:
        print(f"FAIL: Spending is not red (classes: {classes})")

    # 2. Add Payment (Positive)
    page.click("button:has-text('Ödeme (Yatırma)')")
    page.fill("input[placeholder='Örn: Telefon, Market']", "Payment")
    page.fill("input[placeholder='0.00']", "200")
    page.click("button:has-text('Ekle')")

    page.wait_for_timeout(500)

    pay_item = page.locator("div.flex.items-center.justify-between:has-text('Payment')")
    pay_amount_div = pay_item.locator("div.font-bold")
    pay_amount_text = pay_amount_div.text_content()

    print(f"Payment Amount Text: {pay_amount_text}")
    # Should be "+200,00 ₺"

    if "+" in pay_amount_text and "200" in pay_amount_text:
        print("PASS: Payment added as positive")
    else:
        print("FAIL: Payment not displayed as positive")

    classes = pay_amount_div.get_attribute("class")
    if "text-green-500" in classes:
        print("PASS: Payment is green")
    else:
        print(f"FAIL: Payment is not green (classes: {classes})")

    # 3. Check Total
    # Total Spending -500. Total Payment +200. Total Debt = -300.
    # Display should be "300,00 ₺" (Absolute value).
    # Card title "Bu Ay Ödenecek"

    total_card = page.locator("div:has-text('Bu Ay Ödenecek') >> div.text-3xl")
    total_text = total_card.text_content()
    print(f"Total Display: {total_text}")

    if "300,00" in total_text:
        print("PASS: Total calculated correctly")
    else:
        print(f"FAIL: Total incorrect (Expected ~300)")

    page.screenshot(path="verification/debt_logic.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_debt.png")
        finally:
            browser.close()
