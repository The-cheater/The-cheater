name: Update README Stats

on:
  schedule:
    - cron: "0 6 * * *"   # every day at 06:00 UTC — adjust as you like
  workflow_dispatch: {}    # lets you trigger it manually from the Actions tab

permissions:
  contents: write

jobs:
  update-readme:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Update README
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_USERNAME: The-cheater
        run: node scripts/update-readme.js

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git diff --quiet README.md || (git add README.md && git commit -m "chore: update live GitHub stats" && git push)
