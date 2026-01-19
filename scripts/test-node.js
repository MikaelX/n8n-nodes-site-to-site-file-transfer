#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Testing n8n node structure...\n');

let errors = 0;
let warnings = 0;

// Check if dist folder exists
const distPath = path.join(__dirname, '../dist');
if (!fs.existsSync(distPath)) {
	console.error('❌ dist/ folder does not exist. Run "yarn build" first.');
	errors++;
	process.exit(1);
}

// Check if node file exists
const nodeFile = path.join(distPath, 'nodes/SiteToSiteFileTransfer/SiteToSiteFileTransfer.node.js');
if (!fs.existsSync(nodeFile)) {
	console.error('❌ Node file not found:', nodeFile);
	errors++;
} else {
	console.log('✓ Node file exists:', nodeFile);
	
	// Check if file has proper exports
	const content = fs.readFileSync(nodeFile, 'utf8');
	if (!content.includes('exports.SiteToSiteFileTransfer') && !content.includes('module.exports.SiteToSiteFileTransfer')) {
		console.warn('⚠️  Node file may not have proper exports');
		warnings++;
	} else {
		console.log('✓ Node file has proper exports');
	}
}

// Check if icon exists
const iconFile = path.join(__dirname, '../src/nodes/SiteToSiteFileTransfer/transfer.svg');
if (!fs.existsSync(iconFile)) {
	console.warn('⚠️  Icon file not found:', iconFile);
	warnings++;
} else {
	console.log('✓ Icon file exists:', iconFile);
}

// Check package.json structure
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	
	if (!packageJson.n8n) {
		console.error('❌ package.json missing n8n configuration');
		errors++;
	} else {
		console.log('✓ package.json has n8n configuration');
		
		if (!packageJson.n8n.nodes || !Array.isArray(packageJson.n8n.nodes)) {
			console.error('❌ package.json n8n.nodes is not an array');
			errors++;
		} else if (packageJson.n8n.nodes.length === 0) {
			console.error('❌ package.json n8n.nodes is empty');
			errors++;
		} else {
			console.log(`✓ package.json has ${packageJson.n8n.nodes.length} node(s) configured`);
		}
	}
} else {
	console.error('❌ package.json not found');
	errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors === 0 && warnings === 0) {
	console.log('✅ All checks passed!');
	process.exit(0);
} else {
	if (errors > 0) {
		console.error(`❌ ${errors} error(s) found`);
	}
	if (warnings > 0) {
		console.warn(`⚠️  ${warnings} warning(s) found`);
	}
	process.exit(errors > 0 ? 1 : 0);
}
