# n8n-nodes-site-to-site-file-transfer

An n8n community node for streaming file transfers between URLs without loading entire files into memory. This node efficiently transfers files from a download URL directly to an upload URL using Node.js streams.

## Features

- **Memory Efficient**: Streams files directly without loading entire files into memory
- **Large File Support**: Handles files of any size with constant memory usage
- **Flexible Authentication**: Supports bearer tokens in URL query strings or custom headers
- **Configurable**: Supports both POST and PUT methods, custom headers, and error handling
- **Progress Tracking**: Built-in error handling and status reporting

## Installation

```bash
npm install n8n-nodes-site-to-site-file-transfer
```

After installation, restart your n8n instance. The node will be automatically available.

## Usage

### Basic Transfer

1. Add the "Site to Site File Transfer" node to your workflow
2. Configure:
   - **Download URL**: The URL to download the file from
   - **Upload URL**: The URL to upload the file to
3. Execute the workflow

### Advanced Configuration

- **Content Length**: Optional file size in bytes (will be auto-detected from download response if not provided)
- **HTTP Method**: Choose POST or PUT (default: POST)
- **Download Headers**: JSON object with custom headers for download request
- **Upload Headers**: JSON object with custom headers for upload request
- **Throw Error on Non-2xx**: Whether to fail execution on error status codes

### Bearer Token Support

If your upload URL contains a `bearer` query parameter, it will be automatically used for authentication. Example:

```
https://example.com/upload?bearer=eyJhbGciOiJIUzI1NiJ9...
```

## Example Workflow

```
Download URL: https://storage.googleapis.com/...
Upload URL: https://api.example.com/upload?bearer=...
Method: POST
Content Length: (auto-detected)
```

## Output

The node returns:
- `success`: Boolean indicating transfer success
- `downloadStatus`: HTTP status code from download
- `uploadStatus`: HTTP status code from upload
- `uploadResponse`: Response data from upload endpoint

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

## License

MIT

