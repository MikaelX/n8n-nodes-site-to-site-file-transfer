# Testing Stream File Transfer Node

## Quick Test

Run the test script to verify the node structure:
```bash
yarn test:node
```

## Unit Tests

Run unit tests with Jest:
```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

### Test Coverage

The test suite includes:
- **GenericFunctions tests**: Tests for `extractBearerToken` and `parseHeaders` utilities
- **transferFile.operation tests**: Tests for the main file transfer operation with mocked HTTP requests

## Testing with Local n8n

### Option 1: Development Mode (Recommended)

This starts n8n with your node loaded and watches for changes:

```bash
yarn dev
```

This will:
- Build the node automatically
- Start n8n on `http://localhost:5678`
- Watch for changes and rebuild automatically
- Link the node to n8n's custom nodes directory

### Option 2: Link to Running n8n

If you already have n8n running:

```bash
# Build the node
yarn build

# Link to n8n's custom nodes directory
mkdir -p ~/.n8n/custom
rm -rf ~/.n8n/custom/n8n-nodes-stream-file
ln -sfn $(pwd)/dist ~/.n8n/custom/n8n-nodes-stream-file

# Restart n8n or wait for auto-reload (if N8N_DEV_RELOAD=true)
```

### Option 3: Install as Package

```bash
# Build the node
yarn build

# In your n8n installation directory
yarn add /path/to/n8n-nodes-stream-file

# Restart n8n
```

## Verifying Installation

1. Open n8n in your browser (usually `http://localhost:5678`)
2. Create a new workflow
3. Click **Add Node**
4. Search for **"Stream File Transfer"**
5. You should see the node in the results
6. Add the node and verify:
   - All fields are visible (Download URL, Upload URL, etc.)
   - HTTP Method dropdown shows POST and PUT options

## Testing Operations

### Test Basic File Transfer

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: A publicly accessible file URL (e.g., `https://example.com/test-file.zip`)
   - **Upload URL**: An endpoint that accepts file uploads (e.g., `https://httpbin.org/post`)
   - **HTTP Method**: POST (default)
3. Execute the node
4. Should return success with download and upload status codes

### Test with Bearer Token in URL

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: A publicly accessible file URL
   - **Upload URL**: An endpoint with bearer token in query string (e.g., `https://api.example.com/upload?bearer=your-token-here`)
   - **HTTP Method**: POST
3. Execute the node
4. The bearer token should be automatically extracted and added to the Authorization header

### Test with Custom Headers

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: A file URL that requires authentication
   - **Download Headers**: 
     ```json
     {
       "Authorization": "Bearer download-token",
       "X-Custom-Header": "value"
     }
     ```
   - **Upload URL**: An upload endpoint
   - **Upload Headers**:
     ```json
     {
       "X-Custom-Upload-Header": "value"
     }
     ```
3. Execute the node
4. Custom headers should be sent with respective requests

### Test PUT Method

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: A file URL
   - **Upload URL**: An endpoint that accepts PUT requests
   - **HTTP Method**: PUT
3. Execute the node
4. Should use PUT method for upload

### Test Error Handling

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: An invalid or inaccessible URL
   - **Upload URL**: A valid upload endpoint
   - **Throw Error on Non-2xx**: true (default)
3. Execute the node
4. Should throw an error with descriptive message

### Test Error Handling (Continue on Fail)

1. Add Stream File Transfer node
2. Configure:
   - **Download URL**: An invalid URL
   - **Upload URL**: A valid upload endpoint
   - **Throw Error on Non-2xx**: false
3. Execute the node
4. Should return error in output without failing the workflow

## Troubleshooting

### Node Not Appearing
- Check build: `yarn build`
- Verify dist folder exists: `ls -la dist/nodes/StreamFileTransfer/`
- Check n8n logs for errors
- Restart n8n

### Build Errors
- Run typecheck: `yarn typecheck`
- Run lint: `yarn lint`
- Check for TypeScript errors

### Runtime Errors
- Check n8n console for error messages
- Verify URLs are accessible
- Check that download URL returns a streamable response
- Verify upload endpoint accepts the specified HTTP method
- Check authentication if required

### Test Failures
- Ensure all dependencies are installed: `yarn install`
- Run tests: `yarn test`
- Check for TypeScript compilation errors: `yarn typecheck`

### Stream Errors
- Ensure download URL returns binary data (not HTML error pages)
- Verify Content-Type headers are correct
- Check that the response is actually streamable
