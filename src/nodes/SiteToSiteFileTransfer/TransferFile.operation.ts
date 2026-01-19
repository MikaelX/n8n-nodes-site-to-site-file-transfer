import type {
	IExecuteFunctions,
	INodeExecutionData,
	IHttpRequestOptions,
	IRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import type { Readable } from 'stream';
import { URL } from 'url';

/**
 * Extract bearer token from URL query string if present
 */
function extractBearerToken(uploadUrl: string): { token: string | null; cleanUrl: string } {
	try {
		const url = new URL(uploadUrl);
		const bearer = url.searchParams.get('bearer');
		if (bearer) {
			// Keep bearer in URL (some APIs require it in query string)
			// But also return it separately for potential header use
			return {
				token: bearer,
				cleanUrl: uploadUrl, // Keep original URL with bearer
			};
		}
	} catch (error) {
		// Invalid URL, return as-is
	}
	return { token: null, cleanUrl: uploadUrl };
}

/**
 * Parse JSON headers parameter
 */
function parseHeaders(headersParam: string | IDataObject): Record<string, string> {
	if (!headersParam) {
		return {};
	}

	if (typeof headersParam === 'string') {
		try {
			const parsed = JSON.parse(headersParam);
			if (typeof parsed === 'object' && parsed !== null) {
				const result: Record<string, string> = {};
				for (const [key, value] of Object.entries(parsed)) {
					if (typeof value === 'string' || typeof value === 'number') {
						result[key] = String(value);
					}
				}
				return result;
			}
		} catch (error) {
			// Invalid JSON, return empty
		}
		return {};
	}

	if (typeof headersParam === 'object' && headersParam !== null) {
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(headersParam)) {
			if (typeof value === 'string' || typeof value === 'number') {
				result[key] = String(value);
			}
		}
		return result;
	}

	return {};
}

export const transferFile = {
	async execute(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
		const downloadUrl = this.getNodeParameter('downloadUrl', itemIndex) as string;
		const uploadUrl = this.getNodeParameter('uploadUrl', itemIndex) as string;
		const contentLength = this.getNodeParameter('contentLength', itemIndex, '') as
			| string
			| number;
		const method = (this.getNodeParameter('method', itemIndex, 'POST') as string) as 'POST' | 'PUT';
		const downloadHeadersParam = this.getNodeParameter('downloadHeaders', itemIndex, '{}') as
			| string
			| IDataObject;
		const uploadHeadersParam = this.getNodeParameter('uploadHeaders', itemIndex, '{}') as
			| string
			| IDataObject;
		const throwOnError = this.getNodeParameter('throwOnError', itemIndex, true) as boolean;

		if (!downloadUrl) {
			throw new Error('Download URL is required');
		}

		if (!uploadUrl) {
			throw new Error('Upload URL is required');
		}

		// Parse headers
		const downloadHeaders = parseHeaders(downloadHeadersParam);
		const uploadHeaders = parseHeaders(uploadHeadersParam);

		// Extract bearer token from upload URL if present
		const { token } = extractBearerToken(uploadUrl);

		// Prepare upload headers
		const finalUploadHeaders: Record<string, string> = {
			'Content-Type': 'application/octet-stream',
			...uploadHeaders,
		};

		// Add Content-Length if provided
		if (contentLength) {
			const length = typeof contentLength === 'number' ? contentLength : parseInt(contentLength, 10);
			if (!isNaN(length) && length > 0) {
				finalUploadHeaders['Content-Length'] = String(length);
			}
		}

		try {
			// Start download request - use request helper for streaming
			const downloadOptions: IRequestOptions = {
				method: 'GET',
				url: downloadUrl,
				headers: downloadHeaders,
				encoding: null, // Get binary/stream response
				resolveWithFullResponse: true,
			};

			const downloadResponse = await this.helpers.request(downloadOptions);

			// Check download response status
			if (downloadResponse.statusCode !== undefined) {
				if (downloadResponse.statusCode < 200 || downloadResponse.statusCode >= 300) {
					const errorMessage = `Download failed with status ${downloadResponse.statusCode}`;
					if (throwOnError) {
						throw new Error(errorMessage);
					}
					return {
						json: {
							error: errorMessage,
							downloadStatus: downloadResponse.statusCode,
						} as IDataObject,
						pairedItem: {
							item: itemIndex,
						},
					};
				}
			}

			// Get actual content length from response if not provided
			const responseHeaders = (downloadResponse as { headers?: Record<string, string> }).headers || {};
			const actualContentLength = contentLength || responseHeaders['content-length'];

			if (actualContentLength && !finalUploadHeaders['Content-Length']) {
				const length =
					typeof actualContentLength === 'number'
						? actualContentLength
						: parseInt(actualContentLength, 10);
				if (!isNaN(length) && length > 0) {
					finalUploadHeaders['Content-Length'] = String(length);
				}
			}

			// Get the stream from download response
			// The request helper returns response.body as a stream when encoding is null
			const downloadStream = (downloadResponse as { body?: Readable }).body as Readable;
			
			if (!downloadStream || typeof downloadStream.pipe !== 'function') {
				throw new Error('Download response is not a stream. Unable to stream file transfer.');
			}

			// Start upload request with download stream as body
			const uploadOptions: IHttpRequestOptions = {
				method,
				url: uploadUrl,
				headers: finalUploadHeaders,
				body: downloadStream, // Pipe download stream directly
			};

			const uploadResponse = await this.helpers.httpRequest(uploadOptions);

			// Check upload response status
			const uploadStatusCode = (uploadResponse as { statusCode?: number }).statusCode;
			if (uploadStatusCode !== undefined) {
				if (uploadStatusCode < 200 || uploadStatusCode >= 300) {
					const errorMessage = `Upload failed with status ${uploadStatusCode}`;
					if (throwOnError) {
						throw new Error(errorMessage);
					}
					return {
						json: {
							error: errorMessage,
							uploadStatus: uploadStatusCode,
							downloadStatus: (downloadResponse as { statusCode?: number }).statusCode,
						} as IDataObject,
						pairedItem: {
							item: itemIndex,
						},
					};
				}
			}

			// Success
			const result: IDataObject = {
				success: true,
				downloadStatus: (downloadResponse as { statusCode?: number }).statusCode || 200,
				uploadStatus: uploadStatusCode || 200,
			};

			// Include response data if available
			if (typeof uploadResponse === 'object' && uploadResponse !== null) {
				result.uploadResponse = uploadResponse as IDataObject;
			} else {
				result.uploadResponse = uploadResponse;
			}

			return {
				json: result,
				pairedItem: {
					item: itemIndex,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (throwOnError) {
				throw new Error(`File transfer failed: ${errorMessage}`);
			}
			return {
				json: {
					error: errorMessage,
					success: false,
				} as IDataObject,
				pairedItem: {
					item: itemIndex,
				},
			};
		}
	},
};

