from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Test Editing Daily Expense
    page.click("a[href='/daily']")
    page.wait_for_selector("h1:has-text('Günlük Defter')")

    # Add Item
    page.fill("input[placeholder='Market, Kahve, vs.']", "Original Daily")
    page.fill("input[placeholder='0.00']", "100")
    page.click("button:has-text('Ekle')")
    page.wait_for_timeout(500)

    # Edit Item
    # Find the edit button for the item "Original Daily"
    # It's in the row.
    item_row = page.locator("div.flex.items-center.justify-between:has-text('Original Daily')")
    item_row.locator("button:has-text('Düzenle')").click()

    # Verify Form Populated
    page.wait_for_timeout(500)
    if page.input_value("input[placeholder='Market, Kahve, vs.']") == "Original Daily":
        print("PASS: Form populated for Daily Expense")
    else:
        print("FAIL: Form not populated")

    # Update Item
    page.fill("input[placeholder='Market, Kahve, vs.']", "Updated Daily")
    page.fill("input[placeholder='0.00']", "150")
    page.click("button:has-text('Güncelle')")

    page.wait_for_timeout(500)

    # Verify List Updated
    if page.is_visible("text=Updated Daily") and page.is_visible("text=150"):
        print("PASS: Daily Expense Updated Successfully")
    else:
        print("FAIL: Daily Expense Update Failed")

    # 2. Test Editing Fixed Expense
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Gelirler')")

    # Add Fixed
    page.fill("input[placeholder='Gider Adı (örn: Kira)']", "Original Fixed")
    page.fill("input[placeholder='Tutar']", "1000")
    page.click("button:has(svg.lucide-plus)") # The Add button
    page.wait_for_timeout(500)

    # Edit Fixed
    fixed_row = page.locator("div.flex.items-center.justify-between:has-text('Original Fixed')")
    # Edit button is the first button in the right-side actions div (usually Pencil icon)
    # The actions are in a flex div.
    # Button with Pencil icon.
    fixed_row.locator("button:has(svg.lucide-pencil)").click()

    # Verify Form Populated
    page.wait_for_timeout(500)
    if page.input_value("input[placeholder='Gider Adı (örn: Kira)']") == "Original Fixed":
        print("PASS: Form populated for Fixed Expense")
    else:
        print("FAIL: Form not populated")

    # Update Fixed
    page.fill("input[placeholder='Gider Adı (örn: Kira)']", "Updated Fixed")
    page.click("button:has(svg.lucide-pencil)") # The Update button (icon changes to pencil when editing)

    page.wait_for_timeout(500)

    if page.is_visible("text=Updated Fixed"):
        print("PASS: Fixed Expense Updated Successfully")
    else:
        print("FAIL: Fixed Expense Update Failed")

    # 3. Test Editing Credit Card Debt
    page.click("a[href='/debt']")
    page.wait_for_selector("h1:has-text('Kredi Kartı Borçları')")

    # Add Debt
    page.fill("input[placeholder='Örn: Telefon, Market']", "Original Debt")
    page.fill("input[placeholder='0.00']", "500")
    page.click("button:has-text('Ekle')")
    page.wait_for_timeout(500)

    # Edit Debt
    debt_row = page.locator("div.flex.items-center.justify-between:has-text('Original Debt')")
    debt_row.locator("button:has(svg.lucide-pencil)").click()

    # Verify Form
    page.wait_for_timeout(500)
    if page.input_value("input[placeholder='Örn: Telefon, Market']") == "Original Debt":
        print("PASS: Form populated for Debt")
    else:
        print("FAIL: Form not populated")

    # Update Debt
    page.fill("input[placeholder='Örn: Telefon, Market']", "Updated Debt")
    page.click("button:has-text('Güncelle')")

    page.wait_for_timeout(500)

    if page.is_visible("text=Updated Debt"):
        print("PASS: Debt Updated Successfully")
    else:
        print("FAIL: Debt Update Failed")

    page.screenshot(path="verification/edit_feature.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_edit.png")
        finally:
            browser.close()
