from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 375, 'height': 812}) # Mobile viewport
    page = context.new_page()

    # 1. Visit Dashboard
    print("Navigating to Dashboard...")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    # Wait for gold prices simulated fetch (800ms)
    page.wait_for_timeout(2000) 
    page.screenshot(path="verification/dashboard.png")
    print("Dashboard screenshot taken.")

    # 2. Visit Settings and Update Income
    print("Navigating to Settings...")
    page.goto("http://localhost:5173/settings")
    page.wait_for_load_state("networkidle")
    
    # Update Income to 50000
    # The first input in Settings is Income
    page.locator('input[type="number"]').nth(0).fill('50000') 
    page.keyboard.press("Tab") # Trigger blur to save
    page.wait_for_timeout(500) # Wait for state update
    page.screenshot(path="verification/settings.png")
    print("Settings screenshot taken.")

    # 3. Visit Gold
    print("Navigating to Gold...")
    page.goto("http://localhost:5173/gold")
    page.wait_for_load_state("networkidle")
    
    # Update Gold Portfolio
    # First input is 22k grams.
    page.locator('input[type="number"]').nth(0).fill('10') 
    page.keyboard.press("Tab")
    page.wait_for_timeout(1000) 
    page.screenshot(path="verification/gold.png")
    print("Gold screenshot taken.")
    
    # 4. Return to Dashboard to verify updates
    print("Returning to Dashboard...")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000) # Wait for render
    page.screenshot(path="verification/dashboard_updated.png")
    print("Updated Dashboard screenshot taken.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
