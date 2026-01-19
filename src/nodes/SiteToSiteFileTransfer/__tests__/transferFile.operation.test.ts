import type { IExecuteFunctions } from 'n8n-workflow';
import { execute } from '../actions/transferFile.operation';
import { Readable } from 'stream';

describe('transferFile.operation', () => {
	let mockExecuteFunctions: Partial<IExecuteFunctions>;
	let mockRequest: jest.Mock;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		mockRequest = jest.fn();
		mockHttpRequest = jest.fn();

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
				httpRequest: mockHttpRequest,
			} as any,
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

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

		mockRequest.mockResolvedValue({
			statusCode: 200,
			headers: {
				'content-length': '18',
			},
			body: mockStream,
		});

		mockHttpRequest.mockResolvedValue({
			statusCode: 200,
			data: 'success',
		});

		const result = await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(result.json).toMatchObject({
			success: true,
			downloadStatus: 200,
			uploadStatus: 200,
		});
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				url: 'https://download.example.com/file.zip',
			})
		);
		expect(mockHttpRequest).toHaveBeenCalledWith(
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

		mockRequest.mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: mockStream,
		});

		mockHttpRequest.mockResolvedValue({
			statusCode: 200,
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer test-token',
				}),
			})
		);
	});

	it('should handle download error when throwOnError is true', async () => {
		mockRequest.mockResolvedValue({
			statusCode: 404,
		});

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

		mockRequest.mockResolvedValue({
			statusCode: 404,
		});

		const result = await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(result.json).toMatchObject({
			error: expect.stringContaining('Download failed with HTTP 404'),
			downloadStatus: 404,
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

		mockRequest.mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: mockStream,
		});

		mockHttpRequest.mockResolvedValue({
			statusCode: 200,
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockHttpRequest).toHaveBeenCalledWith(
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

		mockRequest.mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: mockStream,
		});

		mockHttpRequest.mockResolvedValue({
			statusCode: 200,
		});

		await execute.call(mockExecuteFunctions as IExecuteFunctions, 0);

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Length': '1024',
				}),
			})
		);
	});
});
