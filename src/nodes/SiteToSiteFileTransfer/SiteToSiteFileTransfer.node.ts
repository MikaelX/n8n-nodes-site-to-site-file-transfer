import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { transferFile } from './TransferFile.operation';

export class SiteToSiteFileTransfer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Site to Site File Transfer',
		name: 'siteToSiteFileTransfer',
		icon: 'file:transfer.svg',
		group: ['transform'],
		version: 1,
		description: 'Stream files from a download URL directly to an upload URL without loading into memory',
		defaults: {
			name: 'Site to Site File Transfer',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Download URL',
				name: 'downloadUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'URL to download the file from',
				placeholder: 'https://example.com/file.zip',
			},
			{
				displayName: 'Upload URL',
				name: 'uploadUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'URL to upload the file to',
				placeholder: 'https://upload.example.com/upload',
			},
			{
				displayName: 'Content Length',
				name: 'contentLength',
				type: 'number',
				default: '',
				required: false,
				description: 'File size in bytes (optional, will be detected from download response if not provided)',
			},
			{
				displayName: 'HTTP Method',
				name: 'method',
				type: 'options',
				options: [
					{
						name: 'POST',
						value: 'POST',
					},
					{
						name: 'PUT',
						value: 'PUT',
					},
				],
				default: 'POST',
				description: 'HTTP method to use for upload',
			},
			{
				displayName: 'Download Headers',
				name: 'downloadHeaders',
				type: 'json',
				default: '{}',
				required: false,
				description: 'Additional headers for the download request (JSON object)',
			},
			{
				displayName: 'Upload Headers',
				name: 'uploadHeaders',
				type: 'json',
				default: '{}',
				required: false,
				description: 'Additional headers for the upload request (JSON object). Bearer tokens in upload URL query string are automatically extracted.',
			},
			{
				displayName: 'Throw Error on Non-2xx Status Codes',
				name: 'throwOnError',
				type: 'boolean',
				default: true,
				description: 'Whether to throw an error and fail execution when the API returns a 3xx, 4xx, or 5xx status code',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const result = await transferFile.execute.call(this, itemIndex);
				returnData.push(result);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

