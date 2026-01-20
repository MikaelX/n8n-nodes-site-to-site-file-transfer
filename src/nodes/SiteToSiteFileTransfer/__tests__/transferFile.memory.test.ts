import type { IExecuteFunctions } from 'n8n-workflow';
import { execute } from '../actions/transferFile.operation';
import { Readable } from 'stream';
import * as https from 'https';
import * as http from 'http';

// Mock native HTTP/HTTPS modules
jest.mock('https');
jest.mock('http');

describe('transferFile.operation - Memory Usage', () => {
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockRequest: jest.Mock;
	let mockHttpsRequest: jest.Mock;
	const fileSize = 50 * 1024 * 1024; // 50MB test file (smaller for faster tests)

	// Helper to get memory usage in MB
	function getMemoryMB(): number {
		const usage = process.memoryUsage();
		// heapUsed + external (buffers) gives us total memory in use
		return Math.round((usage.heapUsed + usage.external) / 1024 / 1024);
	}

	// Helper to create a large readable stream that generates data on-demand
	function createLargeStream(size: number): Readable {
		let bytesSent = 0;
		const chunkSize = 256 * 1024; // 256KB chunks
		
		return new Readable({
			highWaterMark: 256 * 1024, // Match our optimized buffer size
			read() {
				if (bytesSent >= size) {
					this.push(null);
					return;
				}
				const remaining = size - bytesSent;
				const currentChunkSize = Math.min(chunkSize, remaining);
				// Create buffer on-demand (not pre-allocated)
				const chunk = Buffer.alloc(currentChunkSize, Math.floor(Math.random() * 256));
				bytesSent += currentChunkSize;
				this.push(chunk);
			},
		});
	}

	beforeEach(() => {
		mockRequest = jest.fn();
		mockHttpsRequest = jest.fn();

		// Mock HTTPS request using spyOn
		jest.spyOn(https, 'request').mockImplementation(mockHttpsRequest as any);
		// Mock HTTP request
		jest.spyOn(http, 'request').mockImplementation(jest.fn() as any);

		mockExecuteFunctions = {
			getNodeParameter: jest.fn((param: string, _itemIndex: number, defaultValue?: any) => {
				const params: Record<string, any> = {
					downloadUrl: 'https://download.example.com/large-file.bin',
					uploadUrl: 'https://upload.example.com/upload',
					contentLength: '',
					method: 'POST',
					downloadHeaders: '{}',
					uploadHeaders: '{}',
					throwOnError: true,
				};
				return params[param] !== undefined ? params[param] : defaultValue;
			}),
			helpers: {
				request: mockRequest,
			} as any,
		};
	});

	function createMockHttpResponse(statusCode: number, headers: Record<string, string>, body: Readable): any {
		// Use the body stream directly as the response
		// Add HTTP response properties to it
		(body as any).statusCode = statusCode;
		(body as any).headers = headers;
		(body as any).destroy = jest.fn();
		return body;
	}

	function createMockHttpRequest(mockRes: any): any {
		const mockReq: any = {
			on: jest.fn((event: string, callback: Function) => {
				if (event === 'error') {
					mockReq._errorCallback = callback;
				}
				return mockReq;
			}),
			end: jest.fn(),
		};
		
		// Call the request callback with response
		setImmediate(() => {
			const requestCallback = mockHttpsRequest.mock.calls[mockHttpsRequest.mock.calls.length - 1]?.[1];
			if (requestCallback) {
				requestCallback(mockRes);
			}
		});
		
		return mockReq;
	}

	afterEach(() => {
		jest.clearAllMocks();
		// Small delay to allow streams to close
		return new Promise((resolve) => setTimeout(resolve, 100));
	});

	it('should use constant memory regardless of file size', async () => {
		// Measure baseline memory
		await new Promise((resolve) => setTimeout(resolve, 100));
		const baselineMemory = getMemoryMB();

		// Mock download response with large stream using native HTTP
		// Important: Create stream fresh for each call to simulate real behavior
		const downloadStream = createLargeStream(fileSize);
		const mockRes = createMockHttpResponse(200, { 'content-length': String(fileSize) }, downloadStream);
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		// Mock upload response - simulate streaming upload WITHOUT buffering
		// Critical: We must consume the stream without storing all chunks in memory
		mockRequest.mockImplementationOnce(async (options: any) => {
			// Simulate streaming: consume the body stream chunk-by-chunk without accumulating
			if (options.body && typeof options.body.pipe === 'function') {
				return new Promise((resolve, reject) => {
					let totalBytes = 0;
					// Consume stream without storing chunks - just count bytes
					options.body.on('data', (chunk: Buffer) => {
						totalBytes += chunk.length;
						// Don't store the chunk - let it be garbage collected
					});
					options.body.on('end', () => {
						resolve({
							statusCode: 200,
							headers: {},
							body: { received: totalBytes, status: 'ok' },
						});
					});
					options.body.on('error', reject);
					// Ensure stream starts flowing
					options.body.resume();
				});
			}
			return {
				statusCode: 200,
				headers: {},
				body: { status: 'ok' },
			};
		});

		// Measure memory before transfer
		const memoryBefore = getMemoryMB();
		const initialMemory = Math.max(baselineMemory, memoryBefore);

		// Start memory monitoring
		const memorySamples: number[] = [memoryBefore];
		const memoryMonitor = setInterval(() => {
			memorySamples.push(getMemoryMB());
		}, 50); // Sample every 50ms for better granularity

		// Execute transfer
		const result = await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		// Stop monitoring
		clearInterval(memoryMonitor);

		// Wait for streams to fully close and cleanup
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const memoryAfter = getMemoryMB();

		// Calculate memory statistics
		const memoryIncrease = memoryAfter - initialMemory;
		const maxMemoryUsed = Math.max(...memorySamples);
		const memoryPeak = maxMemoryUsed - initialMemory;
		const avgMemory = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length;

		// Log memory statistics
		const fileSizeMB = fileSize / 1024 / 1024;
		console.log('\n=== Memory Usage Statistics ===');
		console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
		console.log(`Baseline memory: ${baselineMemory} MB`);
		console.log(`Initial memory: ${initialMemory} MB`);
		console.log(`Peak memory during transfer: ${maxMemoryUsed} MB`);
		console.log(`Average memory during transfer: ${avgMemory.toFixed(2)} MB`);
		console.log(`Memory peak increase: ${memoryPeak.toFixed(2)} MB`);
		console.log(`Final memory: ${memoryAfter} MB`);
		console.log(`Memory increase (final): ${memoryIncrease.toFixed(2)} MB`);
		console.log(`Memory samples collected: ${memorySamples.length}`);
		console.log(`Memory efficiency: ${((1 - memoryPeak / fileSizeMB) * 100).toFixed(2)}% (lower is better)`);
		console.log('==============================\n');

		// Verify transfer succeeded
		expect(result.json).toMatchObject({
			success: true,
			downloadStatus: 200,
			uploadStatus: 200,
		});

		// Critical assertion: Memory increase should be much less than file size
		// For streaming, we expect ~1-20MB increase (buffer overhead)
		// If entire file was loaded, we'd see ~50MB+ increase
		const memoryThresholdMB = Math.min(fileSizeMB * 0.2, 25); // 20% of file size or 25MB max

		// The peak during transfer is the most important metric
		// Final memory might be higher due to test cleanup delays
		expect(memoryPeak).toBeLessThan(memoryThresholdMB);

		// Additional check: Peak memory during transfer should be reasonable
		// For 50MB file, peak should be less than 20MB (allowing for buffers)
		expect(memoryPeak).toBeLessThan(20);
		
		// Log warning if final memory is high (might indicate cleanup issues)
		if (memoryIncrease > memoryThresholdMB) {
			console.warn(`⚠️  Final memory increase (${memoryIncrease.toFixed(2)} MB) is higher than expected. This might indicate cleanup issues, but peak during transfer (${memoryPeak.toFixed(2)} MB) is good.`);
		}
	}, 60000); // 60 second timeout

	it('should maintain low memory usage with multiple transfers', async () => {
		await new Promise((resolve) => setTimeout(resolve, 100));
		const initialMemory = getMemoryMB();
		const memorySamples: number[] = [initialMemory];

		// Perform 3 transfers sequentially
		for (let i = 0; i < 3; i++) {
			const downloadStream = createLargeStream(fileSize);
			const mockRes = createMockHttpResponse(200, { 'content-length': String(fileSize) }, downloadStream);
			const mockReq = createMockHttpRequest(mockRes);
			mockHttpsRequest.mockReturnValue(mockReq);
			
			mockRequest.mockImplementationOnce(async (options: any) => {
				if (options.body && typeof options.body.pipe === 'function') {
					return new Promise((resolve, reject) => {
						// Consume stream without buffering - just count bytes
						let totalBytes = 0;
						options.body.on('data', (chunk: Buffer) => {
							totalBytes += chunk.length;
							// Don't store chunks - let them be garbage collected
						});
						options.body.on('end', () => {
							resolve({
								statusCode: 200,
								headers: {},
								body: { received: totalBytes, status: 'ok' },
							});
						});
						options.body.on('error', reject);
						options.body.resume(); // Start consuming the stream
					});
				}
				return {
					statusCode: 200,
					headers: {},
					body: { status: 'ok' },
				};
			});

			memorySamples.push(getMemoryMB());
			await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);
			memorySamples.push(getMemoryMB());
			await new Promise((resolve) => setTimeout(resolve, 200)); // Allow cleanup
		}

		const maxMemory = Math.max(...memorySamples);
		const memoryIncrease = maxMemory - initialMemory;

		console.log(`\n=== Multiple Transfers Memory Test ===`);
		console.log(`Initial memory: ${initialMemory} MB`);
		console.log(`Peak memory: ${maxMemory} MB`);
		console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
		console.log(`Memory samples: ${memorySamples.map(m => m.toFixed(1)).join(', ')} MB`);
		console.log('=====================================\n');

		// Memory should not accumulate across transfers
		// Each transfer should use similar memory (~10-20MB)
		expect(memoryIncrease).toBeLessThan(30);
	}, 120000);
});
