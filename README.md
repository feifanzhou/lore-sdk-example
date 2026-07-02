# Lore SDK Claude session uploader

A tiny CLI that lists local Claude Code sessions and uploads the selected session to Lore on demand.

## Setup

```sh
npm install
cp .env.example .env
# edit .env and set LORE_UPLOAD_API_KEY
```

## Run

```sh
npm start
```

The CLI scans `~/.claude/projects/**/*.jsonl`, shows a TUI picker, then calls `@loredotlink/sdk` with the selected session id.
