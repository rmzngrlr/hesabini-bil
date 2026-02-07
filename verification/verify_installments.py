from playwright.sync_api import sync_playwright
import time

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Add Installment
    page.click("a[href='/debt']")
    page.wait_for_selector("h1:has-text('Kredi Kartı Borçları')")

    page.fill("input[placeholder='Örn: Telefon, Market']", "Installment Item")
    page.fill("input[placeholder='0.00']", "6000")

    # Toggle Installment
    page.click("button:has-text('Tek Çekim')") # Should change to 'Taksitli'

    # Check if installment count input appears
    if not page.is_visible("input[value='2']"): # Default is 2
        print("FAIL: Installment count input not visible")
    else:
        print("PASS: Installment count input visible")

    # Set to 3 installments
    page.fill("input[value='2']", "3")

    page.click("button:has-text('Ekle')")

    # 2. Verify Active Installment List
    page.wait_for_timeout(500)
    if page.is_visible("text=Installment Item") and page.is_visible("text=2.000,00 ₺/ay"):
        print("PASS: Active installment listed with correct monthly amount")
    else:
        print("FAIL: Active installment not found or incorrect")

    if page.is_visible("text=1 / 3"):
        print("PASS: Progress (1/3) displayed correctly")
    else:
        print("FAIL: Progress display incorrect")

    # 3. Verify Current Month Debt
    # Should have a debt item for "Installment Item (1/3)" with amount 2000
    if page.is_visible("div.font-medium:has-text('Installment Item (1/3)')"):
        print("PASS: Monthly debt item generated automatically")
    else:
        print("FAIL: Monthly debt item not generated")

    # 4. Test "Reset Month" logic
    # Go to settings and reset month
    page.click("a[href='/settings']")
    page.on("dialog", lambda dialog: dialog.accept())
    page.click("button:has-text('Yeni Ay Başlat')")

    page.wait_for_timeout(500)

    # Go back to Debt page
    page.click("a[href='/debt']")
    page.wait_for_timeout(500)

    # Should now see "Installment Item (2/3)" in debts
    if page.is_visible("div.font-medium:has-text('Installment Item (2/3)')"):
        print("PASS: Next month installment (2/3) generated successfully")
    else:
        print("FAIL: Next month installment generation failed")

    # Check Active Installments progress "2 / 3"
    if page.is_visible("text=2 / 3"):
        print("PASS: Installment progress updated to 2/3")
    else:
        print("FAIL: Installment progress update failed")

    page.screenshot(path="verification/installment_test.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_installment.png")
        finally:
            browser.close()
