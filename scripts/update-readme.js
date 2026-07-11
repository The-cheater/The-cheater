// scripts/update-readme.js
// Fetches live GitHub stats for a user and rewrites the fastfetch-style
// block in README.md between the START/END markers.

const fs = require("fs");

const USERNAME = process.env.GH_USERNAME || "The-cheater";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = process.env.README_PATH || "README.md";

const START_MARKER = "<!--STATS:START-->";
const END_MARKER = "<!--STATS:END-->";

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN env var.");
  process.exit(1);
}

const REST_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "readme-stats-bot",
};

async function restGet(url) {
  const res = await fetch(url, { headers: REST_HEADERS });
  if (!res.ok) {
    throw new Error(`REST GET ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "readme-stats-bot",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Fetch all repos owned by the user (paginated) to sum stars.
async function getAllOwnedRepos() {
  let page = 1;
  let all = [];
  while (true) {
    const repos = await restGet(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner`
    );
    all = all.concat(repos);
    if (repos.length < 100) break;
    page++;
  }
  return all;
}

// Sum total commit contributions year-by-year since account creation
// (GraphQL contributionsCollection is capped at 1 year per query).
async function getTotalCommits(createdAt) {
  const startYear = new Date(createdAt).getFullYear();
  const endYear = new Date().getFullYear();
  let total = 0;

  for (let year = startYear; year <= endYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const query = `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            restrictedContributionsCount
          }
        }
      }`;
    const data = await graphql(query, { login: USERNAME, from, to });
    const c = data.user.contributionsCollection;
    total += c.totalCommitContributions + c.restrictedContributionsCount;
  }
  return total;
}

// All-time count of repos contributed to (not bounded by date range).
async function getRepositoriesContributedTo() {
  const query = `
    query($login: String!) {
      user(login: $login) {
        repositoriesContributedTo(
          first: 1
          contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
        ) {
          totalCount
        }
      }
    }`;
  const data = await graphql(query, { login: USERNAME });
  return data.user.repositoriesContributedTo.totalCount;
}

function padDots(label, value, width = 42) {
  const dots = ".".repeat(Math.max(2, width - label.length - String(value).length));
  return `${label}: ${dots} ${value}`;
}

async function main() {
  const profile = await restGet(`https://api.github.com/users/${USERNAME}`);
  const repos = await getAllOwnedRepos();

  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalCommits = await getTotalCommits(profile.created_at);
  const contributedTo = await getRepositoriesContributedTo();

  const block = [
    "- GitHub Stats -------------------------------------------------",
    `. ${padDots("Repos", profile.public_repos)} {Contributed: ${contributedTo}} | Stars: .......... ${totalStars}`,
    `. ${padDots("Commits", totalCommits)} | Followers: ${profile.followers}`,
  ].join("\n");

  const wrapped = `${START_MARKER}\n${block}\n${END_MARKER}`;

  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${START_MARKER} / ${END_MARKER} markers in ${README_PATH}. Add them around your GitHub Stats block first.`
    );
  }

  const updated =
    readme.slice(0, startIdx) + wrapped + readme.slice(endIdx + END_MARKER.length);

  fs.writeFileSync(README_PATH, updated, "utf8");
  console.log("README stats block updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
