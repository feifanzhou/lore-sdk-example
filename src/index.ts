#!/usr/bin/env node
import { select } from '@inquirer/prompts';
import Lore from '@loredotlink/sdk';
import 'dotenv/config';
import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

type ClaudeSession = {
  id: string;
  title: string;
  filePath: string;
  projectName: string;
  updatedAt: Date;
};

async function main() {
  const headless = isHeadlessMode();
  const uploadApiKey = process.env.LORE_UPLOAD_API_KEY?.trim();
  if (!uploadApiKey) {
    throw new Error('Missing LORE_UPLOAD_API_KEY. Copy .env.example to .env and set your Lore Upload API key.');
  }

  const sessions = await findClaudeSessions(CLAUDE_PROJECTS_DIR);
  if (sessions.length === 0) {
    throw new Error(`No Claude Code sessions found under ${CLAUDE_PROJECTS_DIR}`);
  }

  const selected = headless ? sessions[0] : await select({
    message: 'Choose a Claude Code session to upload to Lore',
    pageSize: 15,
    choices: sessions.map((session) => ({
      name: `${session.title} · ${session.projectName} · ${formatDate(session.updatedAt)}`,
      value: session,
      description: `${session.id} · ${session.filePath}`,
    })),
  });

  console.log(`Selected session ID: ${selected.id}`);
  console.log(`Selected session title: ${selected.title}`);

  const uploadClient = new Lore.Upload(uploadApiKey, {
    apiHostname: process.env.LORE_API_HOSTNAME,
  });

  console.log(`Uploading Claude Code session ${selected.id}...`);
  const result = await uploadClient.uploadSessionSnapshot('claude_code', selected.id, {
    metadata: {
      source: 'lore-sdk-example-cli',
      project: selected.projectName,
    },
  });

  console.log(`Uploaded to Lore thread ${result.threadId}${result.reused ? ' (reused existing upload)' : ''}.`);
}

function isHeadlessMode() {
  return process.argv.includes('--headless') || process.env.npm_config_headless === 'true';
}

async function findClaudeSessions(rootDir: string): Promise<ClaudeSession[]> {
  const projectDirs = await safeReaddir(rootDir);
  const sessions: ClaudeSession[] = [];

  for (const projectDirent of projectDirs) {
    if (!projectDirent.isDirectory()) continue;

    const projectDir = path.join(rootDir, projectDirent.name);
    const files = await safeReaddir(projectDir);

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;

      const filePath = path.join(projectDir, file.name);
      const fileStats = await stat(filePath);
      sessions.push({
        id: path.basename(file.name, '.jsonl'),
        title: await readSessionTitle(filePath),
        filePath,
        projectName: projectDirent.name,
        updatedAt: fileStats.mtime,
      });
    }
  }

  return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

async function readSessionTitle(filePath: string) {
  const transcript = await readFile(filePath, 'utf8');
  for (const line of transcript.split('\n')) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line) as { type?: string; aiTitle?: unknown; lastPrompt?: unknown };
      if (event.type === 'ai-title' && typeof event.aiTitle === 'string' && event.aiTitle.trim()) {
        return event.aiTitle.trim();
      }
      if (event.type === 'last-prompt' && typeof event.lastPrompt === 'string' && event.lastPrompt.trim()) {
        return truncate(event.lastPrompt.trim(), 80);
      }
    } catch {
      // Ignore malformed transcript lines; the SDK will validate before upload.
    }
  }

  return 'Untitled session';
}

async function safeReaddir(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
