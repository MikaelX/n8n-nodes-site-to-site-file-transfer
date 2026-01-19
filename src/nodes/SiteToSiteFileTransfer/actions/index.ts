import type { IExecuteFunctions, INodeProperties, INodeExecutionData } from 'n8n-workflow';
import * as transferFile from './transferFile.operation';

export const operations: Record<
	string,
	{
		description: INodeProperties[];
		execute: (this: IExecuteFunctions, itemIndex: number) => Promise<INodeExecutionData>;
	}
> = {
	transferFile: {
		description: transferFile.description,
		execute: transferFile.execute,
	},
};
