import type { IDataObject } from 'n8n-workflow';
import { URL } from 'url';

/**
 * Extract bearer token from URL query string if present
 */
export function extractBearerToken(uploadUrl: string): { token: string | null; cleanUrl: string } {
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
export function parseHeaders(headersParam: string | IDataObject): Record<string, string> {
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
