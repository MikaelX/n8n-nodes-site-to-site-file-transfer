# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### Added
- Initial release of Stream File Transfer node
- Stream files from download URL to upload URL without loading into memory
- Support for POST and PUT HTTP methods
- Bearer token authentication (from URL query string or headers)
- Custom headers for both download and upload requests
- Configurable error handling (throw on error or return error in output)
- Automatic Content-Length detection from download response
- Memory-efficient streaming using native Node.js http/https modules

### Features
- Constant memory usage regardless of file size
- True streaming - files never fully loaded into memory
- Supports large files (GB+) without memory issues
- Perfect for memory-constrained n8n instances
