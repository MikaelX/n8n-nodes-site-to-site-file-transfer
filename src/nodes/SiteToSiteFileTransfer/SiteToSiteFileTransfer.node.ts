import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { operations } from './actions';

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
			// Add operation-specific properties dynamically
			...operations.transferFile.description,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const result = await operations.transferFile.execute.call(this, itemIndex);
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
				if (error instanceof Error) {
					throw error;
				}
				throw new Error(String(error));
			}
		}

		return [returnData];
	}
}

export default SiteToSiteFileTransfer;