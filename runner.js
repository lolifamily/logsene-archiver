`use strict`;
const fetch = require('node-fetch');
const { Octokit } = require("@octokit/core");
const { createAppAuth } = require("@octokit/auth-app");

var fromdate = new Date();
fromdate.setUTCHours(fromdate.getUTCHours() - 1);fromdate.setUTCMinutes(0,0,0);
var todate = new Date();
todate.setUTCMinutes(0,0,0);
var logpath = fromdate.getUTCFullYear() + '/' + (fromdate.getUTCMonth() + 1) + '/' + 
  fromdate.getUTCDate() + '/' + fromdate.getUTCHours() + '/';

(async () => {
  var result = '';
  var data = await (await fetch("https://logsene-receiver.sematext.com/e219b97e-88f1-4f06-b7c4-ea1114a3ce22/_search?scroll=1m",{ 
    method: "POST",
    body: '{"size":10000,"_source": true,"query":{"range":{"@timestamp":{"gte":"' + fromdate.toISOString() + 
      '","lt":"' + todate.toISOString() + '"}}},"sort":[{"@timestamp":"asc"}]}',
    headers: {
      authorization: "apiKey e219b97e-88f1-4f06-b7c4-ea1114a3ce22"
    }
  })).json();
  data.hits.hits.forEach((chunk) => result += (JSON.stringify(chunk._source) + '\n'));
  var _scroll_id = data._scroll_id;

  while(true){
    data = await (await fetch("https://logsene-receiver.sematext.com/e219b97e-88f1-4f06-b7c4-ea1114a3ce22/_search/scroll",{
      method: "POST",
      body: '{"scroll": "1m","scroll_id": "' + _scroll_id + '"}',
      headers: {
        authorization: "apiKey e219b97e-88f1-4f06-b7c4-ea1114a3ce22"
      }
    })).json();
    if(!data.hits.hits.length) break;
    data.hits.hits.forEach((chunk) => result += (JSON.stringify(chunk._source) + '\n'));
    _scroll_id = data._scroll_id;
  }

  const app = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: 122650,
      privateKey: process.env.PRIVATE_KEY
    }
  });
  const { token } = await app.auth({
    type: "installation",
    installationId: 17786381
  });
  const installation = new Octokit({auth: token});
  const {
    data: { commit: { sha: oldcommit_sha }}
  } = await installation.request("/repos/lolifamily/logsene-archive/branches/main");
  const { data: { sha: blob_sha }} = await installation.request("POST /repos/lolifamily/logsene-archive/git/blobs", {
    content: Buffer.from(result).toString('base64'),
    encoding: "base64"
  });
  const { data: { sha: newtree_sha }} = await installation.request("POST /repos/lolifamily/logsene-archive/git/trees", {
    base_tree: oldcommit_sha,
    tree: [{
      "path": logpath + "vercel.json",
      "mode": "100644",
      "type": "blob",
      "sha": blob_sha
    }]
  });
  const { data: {sha: newcommit_sha }} = await installation.request("POST /repos/lolifamily/logsene-archive/git/commits", {
    "message": "Update logs",
    "parents": [oldcommit_sha],
    "tree": newtree_sha
  });
  await installation.request("POST /repos/lolifamily/logsene-archive/git/refs/heads/main", {"sha": newcommit_sha});
})();
