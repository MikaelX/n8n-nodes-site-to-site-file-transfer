import { extractBearerToken, parseHeaders } from '../GenericFunctions';

describe('GenericFunctions', () => {
	describe('extractBearerToken', () => {
		it('should extract bearer token from URL query string', () => {
			const url = 'https://example.com/upload?bearer=test-token-123';
			const result = extractBearerToken(url);
			
			expect(result.token).toBe('test-token-123');
			expect(result.cleanUrl).toBe(url);
		});

		it('should return null token when no bearer parameter exists', () => {
			const url = 'https://example.com/upload';
			const result = extractBearerToken(url);
			
			expect(result.token).toBeNull();
			expect(result.cleanUrl).toBe(url);
		});

		it('should handle URLs with other query parameters', () => {
			const url = 'https://example.com/upload?param1=value1&bearer=token-456&param2=value2';
			const result = extractBearerToken(url);
			
			expect(result.token).toBe('token-456');
			expect(result.cleanUrl).toBe(url);
		});

		it('should handle invalid URLs gracefully', () => {
			const url = 'not-a-valid-url';
			const result = extractBearerToken(url);
			
			expect(result.token).toBeNull();
			expect(result.cleanUrl).toBe(url);
		});

		it('should handle empty bearer parameter', () => {
			const url = 'https://example.com/upload?bearer=';
			const result = extractBearerToken(url);
			
			// URL.searchParams.get returns null for empty values
			expect(result.token).toBeNull();
			expect(result.cleanUrl).toBe(url);
		});
	});

	describe('parseHeaders', () => {
		it('should parse JSON string headers', () => {
			const headers = '{"Authorization": "Bearer token", "Content-Type": "application/json"}';
			const result = parseHeaders(headers);
			
			expect(result).toEqual({
				Authorization: 'Bearer token',
				'Content-Type': 'application/json',
			});
		});

		it('should parse object headers', () => {
			const headers = {
				Authorization: 'Bearer token',
				'Content-Type': 'application/json',
			};
			const result = parseHeaders(headers);
			
			expect(result).toEqual({
				Authorization: 'Bearer token',
				'Content-Type': 'application/json',
			});
		});

		it('should convert number values to strings', () => {
			const headers = {
				'Content-Length': 1024,
				'X-Custom-Header': 42,
			};
			const result = parseHeaders(headers);
			
			expect(result).toEqual({
				'Content-Length': '1024',
				'X-Custom-Header': '42',
			});
		});

		it('should return empty object for empty string', () => {
			const result = parseHeaders('');
			expect(result).toEqual({});
		});

		it('should return empty object for null/undefined', () => {
			expect(parseHeaders(null as any)).toEqual({});
			expect(parseHeaders(undefined as any)).toEqual({});
		});

		it('should handle invalid JSON gracefully', () => {
			const headers = '{"invalid": json}';
			const result = parseHeaders(headers);
			
			expect(result).toEqual({});
		});

		it('should filter out non-string/non-number values', () => {
			const headers = {
				valid: 'value',
				number: 123,
				nullValue: null,
				boolValue: true,
				objectValue: { nested: 'value' },
			};
			const result = parseHeaders(headers);
			
			expect(result).toEqual({
				valid: 'value',
				number: '123',
			});
		});

		it('should handle empty JSON object', () => {
			const result = parseHeaders('{}');
			expect(result).toEqual({});
		});
	});
});
