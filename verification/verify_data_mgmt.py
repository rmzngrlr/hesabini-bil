from playwright.sync_api import sync_playwright
import os
import json
import time

def verify(page):
    page.goto("http://localhost:5173/")

    # 1. Verify Limits removed from Dashboard
    content = page.content()
    if "Nakit Durumu" in content or "Yemek Kartı Durumu" in content:
        print("FAIL: Limits cards still visible on Dashboard")
    else:
        print("PASS: Limits cards removed from Dashboard")

    # 2. Verify Limits removed from Settings and Data Management added
    page.click("a[href='/settings']")
    page.wait_for_selector("h1:has-text('Ayarlar')")

    content = page.content()
    if "Limitler" in content or "Nakit Limiti" in content:
        print("FAIL: Limits section still visible in Settings")
    else:
        print("PASS: Limits section removed from Settings")

    if "Veri Yönetimi" not in content or "Yedek Al" not in content or "Yedek Yükle" not in content:
        print("FAIL: Data Management section not found")
    else:
        print("PASS: Data Management section found")

    page.screenshot(path="verification/settings_data.png")

    # 3. Test Export (Simulated)
    # Testing file download in headless mode can be tricky without configuring download path.
    # We will assume if the button exists and triggers logic, it's likely working,
    # but let's try to intercept download if possible or just verify it's clickable.

    with page.expect_download() as download_info:
        page.click("button:has-text('Yedek Al')")
    download = download_info.value
    path = download.path()
    print(f"PASS: Download triggered, file saved to {path}")

    # Verify content of downloaded file
    # It might be a temporary path, let's read it
    if path:
        with open(path, 'r') as f:
            data = json.load(f)
            if "dailyExpenses" in data and "fixedExpenses" in data:
                print("PASS: Exported JSON has correct structure")
            else:
                print("FAIL: Exported JSON missing keys")

    # 4. Test Import
    # Create a dummy backup file
    dummy_data = {
        "version": 1,
        "income": 9999,
        "rollover": 0,
        "fixedExpenses": [],
        "dailyExpenses": [],
        "ccDebts": []
    }
    dummy_file = "verification/dummy_backup.json"
    with open(dummy_file, 'w') as f:
        json.dump(dummy_data, f)

    # Handle the dialog confirmation
    page.on("dialog", lambda dialog: dialog.accept())

    # Upload file
    # The input is hidden, so we need to set input files on the locator pointing to the input
    page.set_input_files("input[type='file']", dummy_file)

    # Wait for alert or UI update. The handler shows an alert "Yedek başarıyla yüklendi!"
    # The dialog handler above should accept the confirm, then we need to handle the alert.
    # Playwright handles dialogs automatically if a handler is registered.
    # Since we have two dialogs (confirm + alert), we need to be careful.
    # The first dialog is confirm, second is alert.
    # Let's adjust handler to just accept everything.

    # Verify change
    # Go to Fixed Expenses and check if Income is 9999
    page.click("a[href='/fixed']")
    page.wait_for_timeout(500)
    # Use get_attribute to check input value
    income_val = page.locator("input[type='number']").first.input_value()
    if income_val == "9999":
        print("PASS: Import successful, income updated to 9999")
    else:
        print(f"FAIL: Import failed, income is {income_val}")

    page.screenshot(path="verification/import_result.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_data.png")
        finally:
            browser.close()
