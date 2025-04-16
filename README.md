# Claude Config Editor

A desktop application for managing, editing, and applying Claude configuration sets in a portable, reusable format.

## Features

- Select and manage `claude_desktop_config.json` files on macOS and Windows
- Edit JSON configuration values for different keys
- Export and import complete configuration sets
- Apply changes directly to your Claude configuration file

## Setup and Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Rust](https://www.rust-lang.org/learn/get-started) (for Tauri)

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run tauri dev
```

### Building

To build a production version:

```bash
npm run tauri build
```

## Usage

1. Launch the application
2. Click "Select config file" to choose your Claude configuration file
3. Edit configuration values in the JSON editor
4. Click "Apply to Config File" to save changes
5. Use "Export Config Set" to save your configurations for use on other machines

## License

MIT
