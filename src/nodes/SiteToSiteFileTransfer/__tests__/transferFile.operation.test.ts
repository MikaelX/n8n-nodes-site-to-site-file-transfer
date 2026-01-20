import type { IExecuteFunctions } from 'n8n-workflow';
import { execute } from '../actions/transferFile.operation';
import { Readable } from 'stream';
import * as https from 'https';
import * as http from 'http';

// Mock native HTTP/HTTPS modules
jest.mock('https');
jest.mock('http');

describe('transferFile.operation', () => {
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockRequest: jest.Mock;
	let mockHttpsRequest: jest.Mock;

	beforeEach(() => {
		mockRequest = jest.fn();
		mockHttpsRequest = jest.fn();

		// Mock HTTPS request using spyOn
		jest.spyOn(https, 'request').mockImplementation(mockHttpsRequest as any);
		// Mock HTTP request (not used for HTTPS URLs)
		jest.spyOn(http, 'request').mockImplementation(jest.fn() as any);

		mockExecuteFunctions = {
			getNodeParameter: jest.fn((param: string, _itemIndex: number, defaultValue?: any) => {
				const params: Record<string, any> = {
					downloadUrl: 'https://download.example.com/file.zip',
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

	afterEach(() => {
		jest.clearAllMocks();
	});

	function createMockHttpResponse(statusCode: number, headers: Record<string, string>, body: string | Readable) {
		const mockRes = Object.create(Readable.prototype);
		mockRes.statusCode = statusCode;
		mockRes.headers = headers;
		mockRes.on = jest.fn((event: string, callback: Function) => {
			if (event === 'data' && typeof body === 'string') {
				setImmediate(() => callback(Buffer.from(body)));
			}
			if (event === 'end') {
				setImmediate(() => callback());
			}
			return mockRes;
		});
		mockRes.destroy = jest.fn();
		mockRes.pipe = Readable.prototype.pipe;
		return mockRes;
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

	it('should throw error when download URL is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'downloadUrl') return '';
				return 'https://upload.example.com/upload';
			}
		);

		await expect(
			execute.call(mockExecuteFunctions as IExecuteFunctions, 0)
		).rejects.toThrow('Download URL is required and cannot be empty');
	});

	it('should throw error when upload URL is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'uploadUrl') return '';
				return 'https://download.example.com/file.zip';
			}
		);

		await expect(
			execute.call(mockExecuteFunctions as IExecuteFunctions, 0)
		).rejects.toThrow('Upload URL is required and cannot be empty');
	});

	it('should successfully transfer file', async () => {
		const mockStream = new Readable({
			read() {
				this.push('test file content');
				this.push(null);
			},
		});

		const mockRes = createMockHttpResponse(200, { 'content-length': '18' }, mockStream);
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		mockRequest.mockResolvedValueOnce({
			statusCode: 200,
			headers: {},
			body: 'success',
		});

		const result = await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(result.json).toMatchObject({
			success: true,
			downloadStatus: 200,
			uploadStatus: 200,
		});
		expect(mockHttpsRequest).toHaveBeenCalled();
		expect(mockRequest).toHaveBeenCalledTimes(1);
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				url: 'https://upload.example.com/upload',
			})
		);
	});

	it('should extract bearer token from upload URL and add to headers', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'uploadUrl') return 'https://upload.example.com/upload?bearer=test-token';
				return 'https://download.example.com/file.zip';
			}
		);

		const mockStream = new Readable({
			read() {
				this.push('test');
				this.push(null);
			},
		});

		const mockRes = createMockHttpResponse(200, {}, mockStream);
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		mockRequest.mockResolvedValueOnce({
			statusCode: 200,
			headers: {},
			body: {},
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockRequest).toHaveBeenCalledTimes(1);
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-token',
				}),
			})
		);
	});

	it('should handle download error when throwOnError is true', async () => {
		const mockRes = createMockHttpResponse(404, {}, '');
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		await expect(
			execute.call(mockExecuteFunctions as IExecuteFunctions, 0)
		).rejects.toThrow('Download failed with HTTP 404');
	});

	it('should return error result when throwOnError is false and download fails', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'throwOnError') return false;
				return 'https://download.example.com/file.zip';
			}
		);

		const mockRes = createMockHttpResponse(404, {}, '');
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		const result = await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(result.json).toMatchObject({
			error: expect.stringContaining('Download failed with HTTP 404'),
		});
	});

	it('should use PUT method when specified', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'method') return 'PUT';
				return 'https://download.example.com/file.zip';
			}
		);

		const mockStream = new Readable({
			read() {
				this.push('test');
				this.push(null);
			},
		});

		const mockRes = createMockHttpResponse(200, {}, mockStream);
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		mockRequest.mockResolvedValueOnce({
			statusCode: 200,
			headers: {},
			body: {},
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockRequest).toHaveBeenCalledTimes(1);
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'PUT',
			})
		);
	});

	it('should use provided content length', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(param: string) => {
				if (param === 'contentLength') return 1024;
				return 'https://download.example.com/file.zip';
			}
		);

		const mockStream = new Readable({
			read() {
				this.push('test');
				this.push(null);
			},
		});

		const mockRes = createMockHttpResponse(200, {}, mockStream);
		const mockReq = createMockHttpRequest(mockRes);
		mockHttpsRequest.mockReturnValue(mockReq);

		mockRequest.mockResolvedValueOnce({
			statusCode: 200,
			headers: {},
			body: {},
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockRequest).toHaveBeenCalledTimes(1);
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Length': '1024',
				}),
			})
		);
	});
});
