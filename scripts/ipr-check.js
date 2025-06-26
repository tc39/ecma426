#!/usr/bin/env node

// Copied from https://github.com/tc39/ecma262/blob/c316ec72f6e227d88d4ef67a3e16b486c5ca356d/scripts/check-form.js,
// with some simplifications (we do not need to handle IPR for some legacy commits)
// - none of the current committers still need to sign the IPR form
// - none of the current committers use multiple GitHub accounts to commit to this repository

const { execSync } = require('child_process');

// web URL: `https://docs.google.com/spreadsheets/d/${sheetID}/edit`
const sheetID = '1if5bU0aV5MJ27GGKnRzyAozeKP-ILXYl5r3dzvkGFmg';

const {
	GOOGLE_API_KEY: key, // TC39 API key for google sheets
	GH_TOKEN
} = process.env;

if (!GH_TOKEN) {
	throw 'GH_TOKEN env var required';
}
if (!key) {
	throw 'GOOGLE_API_KEY env var required';
}

const sheetData = `https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/Sheet1!A2:A?key=${key}`;

const [,, slug, branchOrSha] = process.argv;

if (!slug || !branchOrSha) {
	throw 'args required: slug, branchOrSha';
}

let sha = branchOrSha;
try {
  sha = String(execSync(`git rev-parse --short ${branchOrSha}`)).trim();
} catch {}

console.log("Getting data for", sha);

const request = async (url, method = 'GET', postData) => {
	// adapted from https://medium.com/@gevorggalstyan/how-to-promisify-node-js-http-https-requests-76a5a58ed90c
	const lib = url.startsWith('https://') ? require('https') : require('http');

	const [h, path] = url.split('://')[1].split('/');
	const [host, port] = h.split(':');

	const params = {
		host,
		port: port || url.startsWith('https://') ? 443 : 80,
		method,
		headers: {
			Authorization: `token ${GH_TOKEN}`,
			'User-Agent': 'curl/7.54.0'
		}
	};

	return new Promise((resolve, reject) => {
		const req = lib.request(url, params, res => {
			if (res.statusCode < 200 || res.statusCode >= 300) {
				return reject(new Error(`Status Code: ${res.statusCode}; ${url}`));
			}

			const data = [];

			res.on('data', chunk => {
				data.push(chunk);
			});

			res.on('end', () => resolve(String(Buffer.concat(data))));
		});

		req.on('error', reject);

		if (postData) {
			req.write(postData);
		}

		req.end();
	});
};

const perPage = 100;

// Old email addresses used in commits that have then been removed
// from the GitHub account of the user.
const oldEmails = new Map([
	["luca.forstner@sentry.io", "lforst"]
]);

function getAuthorFromCommit(commitObj) {
	if (!commitObj) {
		return false;
	}
	const { author } = commitObj;
	if (!author) {
		if (commitObj.commit?.author) {
			const username = oldEmails.get(commitObj.commit.author.email);
			if (username) {
				return username;
			}
		}

    throw new Error("Missing author for commit " + commitObj.sha);
	}
	return author.login;
}

async function getAllCommits(page = 1) {
	const commitsURL = `https://api.github.com/repos/${slug}/commits?anon=1&per_page=${perPage}&page=${page}&sha=${sha}`;
	const commits = await request(commitsURL).then((json) => JSON.parse(json));
	return [...new Set([].concat(
		commits.flatMap(x => getAuthorFromCommit(x) || []),
		commits.length < perPage ? [] : await getAllCommits(page + 1),
	))];
}

const authors = getAllCommits().then((authors) => {
	const knowns = authors.filter(x => typeof x === 'string');
	console.log(`Found ${knowns.length} authors: ${knowns.join(',')}\n`);
	return knowns;
});

const teamURL = (team) => `https://api.github.com/orgs/tc39/teams/${team}`;

function getMembers(teamID, page = 1) {
	const memberURL = `https://api.github.com/teams/${teamID}/members?per_page=100&page=${page}`;
	const data = request(memberURL).then((json) => JSON.parse(json));
	return data.then((data) => {
		if (data.length === 0) {
			return data;
		}
		return getMembers(teamID, page + 1).then(nextPage => {
			return data.concat(nextPage);
		});
	});
}

function handler(kind) {
	return (data) => {
		const names = new Set(data.map(x => x.login.toLowerCase()));
		console.log(`Found ${names.size} ${kind}: ${[...names].join(',')}\n`);
		return names;
	}
}

const delegates = request(teamURL('delegates')).then((json) => JSON.parse(json)).then(data => {
	return getMembers(data.id);
}).then(handler('delegates'));

const emeriti = request(teamURL('emeriti')).then((json) => JSON.parse(json)).then(data => {
	return getMembers(data.id);
}).then(handler('emeriti'));

const usernames = request(sheetData).then((json) => JSON.parse(json)).then(data => {
	if (!Array.isArray(data.values)) {
		throw 'invalid data';
	}
	const usernames = new Set(
		data.values
			.flat(1)
			.map(x => x.replace(/^(https?:\/\/)?github\.com\//, '').replace(/^@/, '').toLowerCase())
			.filter(x => /^[a-z0-9_-]{1,39}$/gi.test(x))
			.sort((a, b) => a.localeCompare(b))
	);
	console.log(`Found ${usernames.size} usernames: ` + [...usernames].join(',') + '\n');
	return usernames;
});

const exceptions = new Set([
  'fitzgen', // former Mozilla employee
  'jaro-sevcik', // Google empolyee
  'jkrems', // Google employee
  'josephschorr', // former Google empolyee
  'sideshowbarker', // Mozilla employee
].map(x => x.toLowerCase()));

Promise.all([usernames, authors, delegates, emeriti]).then(([usernames, authors, delegates, emeriti]) => {
	const missing = authors.filter(author => {
		const a = author.toLowerCase();
		const signed = usernames.has(a)
			|| delegates.has(a)
			|| emeriti.has(a)
			|| exceptions.has(a);
		return !signed;
	});
	if (missing.length > 0) {
		throw `Missing ${missing.length} authors: ${missing}`;
	} else {
		console.log('All authors have signed the form, or are delegates or emeriti!');
	}
}).catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
