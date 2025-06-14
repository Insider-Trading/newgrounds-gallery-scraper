# newgrounds-gallery-scraper

A browser extension for downloading full resolution images from a user's Newgrounds gallery.

## Features

- Works in Firefox and other browsers supporting the WebExtension API.
- Allows the user to paste an exported login cookie in JSON format to access private galleries. The cookies are stored via the browser API so authenticated requests work correctly.
- Dynamically adapts to Newgrounds rate limits when scraping.
- Modifies request and response headers so images can be downloaded without CORS errors.
- Lets the user specify a download subfolder via the popup UI.
- Displays progress for each downloaded file in the popup.

## Usage

1. Load the `extension` directory as a temporary extension in your browser.
2. Open the options page and paste your cookie JSON if authentication is required.
3. Navigate to a Newgrounds gallery and click the extension icon.
4. Enter the desired output folder name and start the scrape.

Images will be saved using the browser's downloads directory in the specified subfolder.
The popup will show how many files have been downloaded as the process runs.
