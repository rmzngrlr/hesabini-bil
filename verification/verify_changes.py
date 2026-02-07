from playwright.sync_api import sync_playwright

def verify(page):
    # 1. Dashboard - Check Gold is gone
    page.goto("http://localhost:5173/")
    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Check if Gold card exists (should not)
    # We can check text content of the page
    content = page.content()
    if "Altın Portföyü" in content or "Altın Portföy Değeri" in content:
        print("FAIL: Gold section still visible on Dashboard")
    else:
        print("PASS: Gold section removed from Dashboard")

    page.screenshot(path="verification/dashboard_initial.png")

    # 2. Daily Expenses
    page.click("text=Günlük")
    page.wait_for_selector("h1:has-text('Günlük Defter')")

    # Add Income
    page.fill("input[type='date']", "2023-10-27") # specific date to be consistent
    page.fill("input[placeholder='0.00']", "500")
    page.fill("input[placeholder='Market, Kahve, vs.']", "Freelance Work")
    page.click("button:has-text('Gelir (+)')")
    page.click("button:has-text('Ekle')")

    # Add Expense
    page.fill("input[placeholder='0.00']", "50")
    page.fill("input[placeholder='Market, Kahve, vs.']", "Morning Coffee")
    page.click("button:has-text('Gider (-)')")
    page.click("button:has-text('Ekle')")

    # Verify List
    # We expect Freelance Work to be green and +
    # We expect Morning Coffee to be red and - (or just red)

    page.wait_for_timeout(500) # wait for render
    page.screenshot(path="verification/daily_expenses.png")

    # Check if elements exist with correct styling classes
    # Freelance Work should have text-green-500
    # Morning Coffee should have text-red-500

    # 3. Dashboard totals
    page.click("text=Özet")
    page.wait_for_selector("h1:has-text('Özet Paneli')")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/dashboard_final.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
