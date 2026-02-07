from playwright.sync_api import sync_playwright

def verify(page):
    page.goto("http://localhost:5173/")

    page.wait_for_selector("h1:has-text('Özet Paneli')")

    # Check if we have 3 cards in the grid.
    # The grid container has class 'grid-cols-1'.

    # Locate the container for the cards
    # It is the first div with grid class after the header.
    grid_container = page.locator("div.grid.gap-4.grid-cols-1").first

    if grid_container.is_visible():
        print("PASS: Grid container with grid-cols-1 found")
    else:
        print("FAIL: Grid container with grid-cols-1 not found")

    # Check bounding box of cards to see if they are stacked.
    # Get the 3 cards
    cards = grid_container.locator("> div") # Direct children divs are cards (actually the Card component wrapper)

    count = cards.count()
    if count >= 3:
        print(f"PASS: Found {count} cards")

        box1 = cards.nth(0).bounding_box()
        box2 = cards.nth(1).bounding_box()
        box3 = cards.nth(2).bounding_box()

        # Check Y coordinates. Box 2 should be below Box 1. Box 3 below Box 2.
        # Allowing some margin error, but strictly greater Y.

        if box2['y'] > box1['y'] and box3['y'] > box2['y']:
            print("PASS: Cards are stacked vertically")
        else:
            print(f"FAIL: Cards are not stacked. Y coords: {box1['y']}, {box2['y']}, {box3['y']}")

            # Check X coordinates. Should be roughly same X if full width, or at least aligned left.
            if box1['x'] == box2['x'] == box3['x']:
                print("PASS: Cards are aligned horizontally (same X)")
    else:
        print(f"FAIL: Expected at least 3 cards, found {count}")

    page.screenshot(path="verification/dashboard_layout.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Set viewport to something mobile-ish or desktop to verify.
        # User implies mobile view in screenshot maybe? The screenshot looked narrow.
        # But 'grid-cols-1' applies to all breakpoints now as I removed 'md:grid-cols-3'.
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_layout.png")
        finally:
            browser.close()
