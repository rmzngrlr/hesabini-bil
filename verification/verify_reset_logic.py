from playwright.sync_api import sync_playwright
import json

def verify(page):
    # Prepare Mock Data for "Previous Month"
    mock_data = {
        "version": 3,
        "currentMonth": "2023-01",
        "income": 10000,
        "rollover": 0,
        "ykIncome": 2000,
        "ykRollover": 0,
        "fixedExpenses": [
            {"id": "fix1", "title": "Rent", "amount": 5000, "isPaid": True}
        ],
        "dailyExpenses": [
            {"id": "d1", "description": "Cash Spend", "amount": -500, "date": "2023-01-15", "type": "NAKIT"},
            {"id": "d2", "description": "YK Spend", "amount": -200, "date": "2023-01-15", "type": "YK"}
        ],
        "ccDebts": [
            {"id": "cc1", "description": "Old Debt", "amount": -1500}
        ],
        "installments": [],
        "history": []
    }

    # 1. Inject Data and Load Page
    page.add_init_script(f"""
        localStorage.setItem('budget_app_data', '{json.dumps(mock_data)}');
    """)

    print("Loading page with injected previous month data...")
    page.goto("http://localhost:5173/")

    # Allow time for useEffect to run and update state
    page.wait_for_timeout(2000)

    # 2. Go to Fixed Expenses page
    print("Navigating to Fixed Expenses...")
    page.click("a[href='/fixed']")
    page.wait_for_url("**/fixed")

    # 3. Check "Devreden (Nakit)" (Rollover)
    # Expected: 10000 - 5000 (Rent) - 500 (Cash Spend) = 4500
    # Input is inside a Card with title "Devreden (Nakit)"

    # Locator strategy: Find a div that contains the text "Devreden (Nakit)", then find the input inside it (or following it)
    # Since Card renders title, let's try to find the container.

    rollover_input = page.locator("div").filter(has_text="Devreden (Nakit)").last.locator("input")
    # .last because "Devreden (Nakit)" text might be in the header of the card and we want the container or input within that context

    # Alternatively:
    # page.locator("text=Devreden (Nakit) >> .. >> input")

    rollover_value = rollover_input.input_value()
    print(f"Rollover Value Found: {rollover_value}")

    if "4500" in rollover_value:
        print("PASS: Rollover (Cash) is correct (4500)")
    else:
        print(f"FAIL: Rollover (Cash) incorrect. Expected 4500, got {rollover_value}")

    # 4. Check "Yemek Kartı Devreden" (YK Rollover)
    # Expected: 2000 - 200 = 1800
    yk_rollover_input = page.locator("div").filter(has_text="Yemek Kartı Devreden").last.locator("input")
    yk_rollover_value = yk_rollover_input.input_value()
    print(f"YK Rollover Value Found: {yk_rollover_value}")

    if "1800" in yk_rollover_value:
        print("PASS: YK Rollover is correct (1800)")
    else:
        print(f"FAIL: YK Rollover incorrect. Expected 1800, got {yk_rollover_value}")

    # 5. Check "Kredi Kartı Borcu (Geçen Ay)" in Fixed Expenses
    # Should be 1500 (Positive, as it's an expense to be paid)

    # Look for the row in Fixed Expenses list
    cc_debt_item = page.locator("button").filter(has_text="Kredi Kartı Borcu (Geçen Ay)")

    if cc_debt_item.count() > 0:
        print("PASS: 'Kredi Kartı Borcu (Geçen Ay)' found in Fixed Expenses")
        # The amount is in a div inside the button
        text_content = cc_debt_item.text_content()
        print(f"CC Debt Item Text: {text_content}")

        if "1.500" in text_content or "1500" in text_content:
             print("PASS: CC Debt Amount is correct (1500)")
        else:
             print("FAIL: CC Debt Amount incorrect in text.")
    else:
        print("FAIL: 'Kredi Kartı Borcu (Geçen Ay)' NOT found in Fixed Expenses")
        page.screenshot(path="verification/fail_cc_debt.png")

    page.screenshot(path="verification/reset_logic_success.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_reset.png")
        finally:
            browser.close()
