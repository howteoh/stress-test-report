# Stress Test Report Chrome Extension

A Chrome extension for generating stress test reports from Jira issues.

## Features

- Automatically fetches Jira issues
- Filters issues by keywords
- Formats report with proper indentation
- Auto-updates every hour
- Checks for updates on Chrome startup

## Installation

1. Download the latest release
2. Open Chrome Extensions page (chrome://extensions/)
3. Enable Developer Mode
4. Drag and drop the .crx file to install

## Usage

1. Click the extension icon
2. Enter keywords to filter issues (optional)
3. View formatted report
4. Copy to clipboard as needed

## Development

Required files:
- manifest.json: Extension configuration
- popup.html: UI layout
- popup.js: Main functionality
- background.js: Auto-update service 