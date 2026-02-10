#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// --- Constants ---

const PLUGIN_NAME = 'figma-agent';

const SKILL_NAMES = [
  'interpret-layout',
  'generate-react',
  'generate-html',
  'extract-tokens',
  'map-payload-block',
  'audit-plugin',
];

const SKILL_DESCRIPTIONS = {
  'interpret-layout': 'Interpret Auto Layout -> CSS Flexbox',
  'generate-react':   'Generate React/TSX from Figma node',
  'generate-html':    'Generate HTML + layered CSS',
  'extract-tokens':   'Extract design tokens -> CSS vars + Tailwind',
  'map-payload-block': 'Map Figma component -> PayloadCMS block',
  'audit-plugin':     'Audit plugin against best practices',
};

// --- Paths ---

const PKG_ROOT = path.resolve(__dirname, '..');

function getGlobalBase() {
  return path.join(os.homedir(), '.claude');
}

function getLocalBase() {
  return path.join(process.cwd(), '.claude');
}

function getTargets(base) {
  return {
    commands: path.join(base, 'commands', PLUGIN_NAME),
    knowledge: path.join(base, PLUGIN_NAME, 'knowledge'),
  };
}

function getKnowledgeRefPath(base) {
  // For global: @~/.claude/figma-agent/knowledge/filename.md
  // For local: @.claude/figma-agent/knowledge/filename.md
  const home = os.homedir();
  if (base.startsWith(home)) {
    return `~/.claude/${PLUGIN_NAME}/knowledge`;
  }
  return `.claude/${PLUGIN_NAME}/knowledge`;
}

// --- File operations ---

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getKnowledgeFiles() {
  const knowledgeDir = path.join(PKG_ROOT, 'knowledge');
  return fs.readdirSync(knowledgeDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

function copyWithPathReplacement(src, dest, replacements) {
  let content = fs.readFileSync(src, 'utf-8');
  for (const [search, replace] of replacements) {
    content = content.replaceAll(search, replace);
  }
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf-8');
}

// --- Install ---

function install(base) {
  const targets = getTargets(base);
  const knowledgeRefPath = getKnowledgeRefPath(base);
  const replacements = [
    ['@knowledge/', `@${knowledgeRefPath}/`],
  ];

  // Validate source files
  console.log('Validating source files...');
  let missing = 0;

  for (const name of SKILL_NAMES) {
    const src = path.join(PKG_ROOT, 'skills', name, 'SKILL.md');
    if (!fs.existsSync(src)) {
      console.log(`  ERROR: Missing skill: skills/${name}/SKILL.md`);
      missing++;
    }
  }

  const knowledgeFiles = getKnowledgeFiles();
  for (const file of knowledgeFiles) {
    const src = path.join(PKG_ROOT, 'knowledge', file);
    if (!fs.existsSync(src)) {
      console.log(`  ERROR: Missing knowledge file: knowledge/${file}`);
      missing++;
    }
  }

  if (missing > 0) {
    console.log(`\nAborting: ${missing} source file(s) missing.`);
    process.exit(1);
  }
  console.log(`  ${SKILL_NAMES.length} skills + ${knowledgeFiles.length} knowledge files found.`);
  console.log('');

  // Copy skills as commands
  console.log('Installing skills...');
  let skillCount = 0;
  for (const name of SKILL_NAMES) {
    const src = path.join(PKG_ROOT, 'skills', name, 'SKILL.md');
    const dest = path.join(targets.commands, `${name}.md`);
    copyWithPathReplacement(src, dest, replacements);
    console.log(`  ${name}.md`);
    skillCount++;
  }
  console.log('');

  // Copy knowledge files
  console.log('Installing knowledge modules...');
  let knowledgeCount = 0;
  for (const file of knowledgeFiles) {
    const src = path.join(PKG_ROOT, 'knowledge', file);
    const dest = path.join(targets.knowledge, file);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`  ${file}`);
    knowledgeCount++;
  }
  console.log('');

  // Summary
  const location = base === getGlobalBase() ? 'global (~/.claude/)' : `local (${path.relative(process.cwd(), base) || '.claude/'})`;
  console.log(`Installed ${skillCount} skills + ${knowledgeCount} knowledge modules (${location})`);
  console.log('');
  console.log('Invoke skills in Claude Code:');
  for (const name of SKILL_NAMES) {
    const desc = SKILL_DESCRIPTIONS[name] || '';
    console.log(`  /figma-agent:${name.padEnd(22)} ${desc}`);
  }
  console.log('');
  console.log('Tip: Use /clear before invoking a skill for a fresh context window.');
}

// --- Uninstall ---

function uninstall(base) {
  const targets = getTargets(base);
  let removed = 0;

  console.log('Uninstalling Figma Agent...');
  console.log('');

  // Remove command files
  if (fs.existsSync(targets.commands)) {
    const files = fs.readdirSync(targets.commands);
    for (const file of files) {
      fs.unlinkSync(path.join(targets.commands, file));
      console.log(`  Removed command: ${file}`);
      removed++;
    }
    fs.rmSync(targets.commands, { recursive: true, force: true });
  }

  // Remove knowledge files
  if (fs.existsSync(targets.knowledge)) {
    const files = fs.readdirSync(targets.knowledge);
    for (const file of files) {
      fs.unlinkSync(path.join(targets.knowledge, file));
      console.log(`  Removed knowledge: ${file}`);
      removed++;
    }
    fs.rmSync(targets.knowledge, { recursive: true, force: true });

    // Remove parent figma-agent directory if empty
    const parentDir = path.dirname(targets.knowledge);
    try {
      const remaining = fs.readdirSync(parentDir);
      if (remaining.length === 0) {
        fs.rmdirSync(parentDir);
      }
    } catch {
      // Ignore — parent may not exist or may not be empty
    }
  }

  console.log('');
  if (removed === 0) {
    console.log('Nothing to remove — Figma Agent is not installed at this location.');
  } else {
    console.log(`Done. Removed ${removed} file(s).`);
  }
}

// --- Interactive prompt ---

function prompt(question, choices) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(question);
    console.log('');
    choices.forEach((choice, i) => {
      console.log(`  ${i + 1}) ${choice.label}`);
    });
    console.log('');

    rl.question('Choose [1-' + choices.length + ']: ', (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < choices.length) {
        resolve(choices[idx].value);
      } else {
        console.log('Invalid choice. Defaulting to global install.');
        resolve('global');
      }
    });
  });
}

// --- CLI ---

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let mode = null;
  let isUninstall = false;
  let showHelp = false;

  for (const arg of args) {
    switch (arg) {
      case '--global':
      case '-g':
        mode = 'global';
        break;
      case '--local':
      case '-l':
        mode = 'local';
        break;
      case '--uninstall':
      case '-u':
        isUninstall = true;
        break;
      case '--help':
      case '-h':
        showHelp = true;
        break;
      default:
        console.log(`Unknown option: ${arg}`);
        showHelp = true;
        break;
    }
  }

  if (showHelp) {
    console.log(`
Figma Agent — npx installer

Usage: npx figma-agent [OPTIONS]

Options:
  --global, -g     Install to ~/.claude/ (available in all projects)
  --local, -l      Install to .claude/ in current project
  --uninstall, -u  Remove installed files
  --help, -h       Show this help message

Examples:
  npx figma-agent              Interactive mode (choose global or local)
  npx figma-agent --global     Install globally to ~/.claude/
  npx figma-agent --local      Install to current project's .claude/
  npx figma-agent --uninstall  Remove from ~/.claude/ (default)
  npx figma-agent --uninstall --local  Remove from .claude/
`);
    process.exit(0);
  }

  // Handle uninstall
  if (isUninstall) {
    const base = mode === 'local' ? getLocalBase() : getGlobalBase();
    uninstall(base);
    return;
  }

  // If no mode specified, prompt interactively
  if (!mode) {
    mode = await prompt('Where should Figma Agent be installed?', [
      { label: 'Global — ~/.claude/ (available in all projects)', value: 'global' },
      { label: 'Local — .claude/ (current project only)', value: 'local' },
    ]);
    console.log('');
  }

  const base = mode === 'local' ? getLocalBase() : getGlobalBase();
  install(base);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
