from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify "Kredi Kartı" renaming in Dashboard
    page.wait_for_selector("h1:has-text('Özet Paneli')")
    content = page.content()
    if "Toplam Kredi Kartı Borcu" not in content:
        print("FAIL: 'Toplam Kredi Kartı Borcu' text not found")
    else:
        print("PASS: 'Toplam Kredi Kartı Borcu' renamed successfully")

    # 2. Verify "Yemek Kartı" renaming in Dashboard
    if "Yemek Kartı Durumu" not in content:
         print("FAIL: 'Yemek Kartı Durumu' text not found")
    else:
         print("PASS: 'Yemek Kartı Durumu' renamed successfully")

    page.screenshot(path="verification/dashboard_renamed.png")

    # 3. Verify Settings Page (removed income/rollover)
    page.click("a[href='/settings']")
    page.wait_for_selector("h1:has-text('Ayarlar')")
    content = page.content()
    if "Aylık Gelir" in content or "Geçen Aydan Devreden" in content:
        print("FAIL: Income/Rollover still in Settings")
    else:
        print("PASS: Income/Rollover removed from Settings")

    if "Yemek Kartı Limiti" not in content:
        print("FAIL: 'Yemek Kartı Limiti' text not found in Settings")
    else:
        print("PASS: 'Yemek Kartı Limiti' renamed successfully")

    page.screenshot(path="verification/settings_updated.png")

    # 4. Verify Fixed Expenses Page (added income/rollover)
    page.click("a[href='/fixed']")
    page.wait_for_selector("h1:has-text('Sabit Giderler')")
    content = page.content()
    if "Aylık Gelir" not in content or "Devreden" not in content:
        print("FAIL: Income/Rollover not found in Fixed Expenses")
    else:
        print("PASS: Income/Rollover moved to Fixed Expenses")

    page.screenshot(path="verification/fixed_updated.png")

    # 5. Verify Daily Expenses (Yemek Kartı button)
    page.click("a[href='/daily']")
    page.wait_for_selector("h1:has-text('Günlük Defter')")
    content = page.content()
    if "Yemek Kartı" not in content:
        print("FAIL: 'Yemek Kartı' button not found in Daily Expenses")
    else:
        print("PASS: 'Yemek Kartı' button found in Daily Expenses")

    page.screenshot(path="verification/daily_renamed.png")


if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_renaming.png")
        finally:
            browser.close()
