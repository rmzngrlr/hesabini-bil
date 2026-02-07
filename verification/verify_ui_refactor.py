from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Fixed Expenses UI (Separate Cards)
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Giderler')")

    # Check for "Aylık Gelir" card
    if not page.is_visible("text=Aylık Gelir"):
        print("FAIL: 'Aylık Gelir' section not found")
    else:
        print("PASS: 'Aylık Gelir' section found")

    # Check for "Geçen Aydan Devreden" card
    if not page.is_visible("text=Geçen Aydan Devreden"):
         print("FAIL: 'Geçen Aydan Devreden' section not found")
    else:
         print("PASS: 'Geçen Aydan Devreden' section found")

    # We expect them to be in a grid, not necessarily nested under "Gelir ve Devreden" anymore
    # The previous implementation had a "Gelir ve Devreden" card.
    # The new one has two separate cards.
    content = page.content()
    if "Gelir ve Devreden" in content:
        print("FAIL: 'Gelir ve Devreden' container title still exists (should be split)")
    else:
        print("PASS: 'Gelir ve Devreden' container title removed (split successfully)")

    page.screenshot(path="verification/fixed_split.png")

    # 2. Verify Daily Expenses UI (Tabs and Grouping)
    page.click("a[href='/daily']")
    page.wait_for_selector("h1:has-text('Günlük Defter')")

    # Check Tabs
    if page.is_visible("button:has-text('Nakit Harcamalar')") and page.is_visible("button:has-text('Yemek Kartı')"):
        print("PASS: Daily Expenses Tabs found")
    else:
        print("FAIL: Daily Expenses Tabs not found")

    # Add a Nakit Expense
    page.fill("input[placeholder='Market, Kahve, vs.']", "Nakit Test Item")
    page.fill("input[placeholder='0.00']", "100")

    # We must explicitly click "Nakit" to set type, which now also sets active tab.
    # But since we want to test filtering, let's just make sure "Nakit" is selected.
    # The form submission uses 'type' state. The list uses 'activeTab' state.

    page.click("button:has-text('Nakit')") # Select Nakit Type (and tab)
    page.click("button:has-text('Ekle')")

    # Add a YK Expense
    page.fill("input[placeholder='Market, Kahve, vs.']", "YK Test Item")
    page.fill("input[placeholder='0.00']", "50")
    page.click("button:has-text('Yemek Kartı')") # Select YK Type (and tab)
    page.click("button:has-text('Ekle')")

    # At this point, we just added a YK item and clicked "Yemek Kartı", so activeTab should be YK.
    # We should see YK item and NOT Nakit item.
    page.wait_for_timeout(500)

    # Switch to Nakit Tab explicitly to verify filtering
    page.click("button:has-text('Nakit Harcamalar')") # This is the tab button
    page.wait_for_timeout(500)

    if page.is_visible("text=Nakit Test Item") and not page.is_visible("text=YK Test Item"):
        print("PASS: Nakit tab filtering correct")
    else:
        print("FAIL: Nakit tab filtering incorrect")

    # Switch to YK Tab
    page.click("button:has-text('Yemek Kartı')") # This is the tab button, same text as type button but context matters
    # Use specific selector for Tab button if possible or just rely on text
    # The type buttons are inside the form. The tab buttons are outside.
    # Playwright's has-text might match the first one found.
    # The tabs are likely after the form.
    # Let's use a better selector strategy if needed, but 'text=' usually finds visible ones.
    # But since there are duplicate texts ("Nakit" vs "Nakit Harcamalar" is distinct, "Yemek Kartı" is duplicate)

    # The tab "Yemek Kartı" is distinct from the type button "Yemek Kartı" by position,
    # but let's try to click the one that acts as a tab.
    # The script clicked "Yemek Kartı" (type button) earlier.

    # Let's find the tab specifically. It has class 'bg-secondary' wrapper usually or we can click by index/order.
    # Or text "Nakit Harcamalar" implies the other tab next to it.

    # Let's assume the previous failure was because we were on YK tab (due to adding YK item last)
    # and checked for Nakit item expecting it to be there by default?
    # No, the script logic was:
    # 1. Add Nakit
    # 2. Add YK (Active tab becomes YK because adding clicks the type button which sets active tab)
    # 3. Check for "Default tab (Nakit)" - THIS FAILED because we were actually on YK tab!

    # Adjusted logic above: I added an explicit switch to Nakit Tab before checking Nakit items.

    page.wait_for_timeout(500)
    if page.is_visible("text=YK Test Item") and not page.is_visible("text=Nakit Test Item"):
        print("PASS: YK tab filtering correct")
    else:
        print("FAIL: YK tab filtering incorrect")

    # Verify Date Header
    if page.locator("h3").count() > 0:
        print("PASS: Date header found")
    else:
        print("FAIL: Date header not found")

    page.screenshot(path="verification/daily_tabs.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_ui_refactor.png")
        finally:
            browser.close()
