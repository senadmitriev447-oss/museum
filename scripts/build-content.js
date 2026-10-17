#!/usr/bin/env node
/* ============================================================
   Сборка индекса контента для школьного музея.

   ЗАЧЕМ ЭТО НУЖНО
   Браузер не умеет «прочитать список файлов в папке» на статичном
   хостинге. Поэтому после каждого сохранения в админке этот скрипт
   собирает все .md-файлы из content/categories, content/tags и
   content/exhibits в три JSON-файла:
       content/categories.json
       content/tags.json
       content/exhibits.json
   Именно их читает сайт (fetch).

   КОГДА ЗАПУСКАЕТСЯ
   • Netlify  — автоматически при каждом деплое (см. netlify.toml).
   • GitHub Pages — автоматически через GitHub Actions
     (см. .github/workflows/build-content.yml).
   • Вручную: node scripts/build-content.js

   Зависимостей нет — нужен только Node.js 16+.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

/* ---------- Мини-парсер YAML (то подмножество, что пишет Decap CMS) ---------- */

/** Разбор одного скаляра: строка в кавычках, число, true/false, null */
function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s[0] === '"' && s[s.length - 1] === '"' && s.length >= 2) {
    try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
  }
  if (s[0] === "'" && s[s.length - 1] === "'" && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  // Короткий flow-список вида [a, b]
  if (s[0] === '[' && s[s.length - 1] === ']') {
    const inner = s.slice(1, -1).trim();
    return inner ? inner.split(',').map(parseScalar) : [];
  }
  return s;
}

/** Блочный скаляр (| или >) — собираем строки с отступом */
function readBlock(lines, start, style) {
  const block = [];
  let i = start;
  while (i < lines.length && (lines[i].trim() === '' || /^\s+/.test(lines[i]))) {
    block.push(lines[i]);
    i++;
  }
  const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length), Infinity);
  const cut = block.map((l) => (l.trim() === '' ? '' : l.slice(isFinite(indent) ? indent : 0)));
  while (cut.length && cut[cut.length - 1] === '') cut.pop();
  let text;
  if (style[0] === '|') {
    text = cut.join('\n');
  } else {
    // «>» — одиночные переносы превращаются в пробел, пустая строка = абзац
    text = cut.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/\n\n/g, '\n');
  }
  if (!style.includes('-')) text += '\n';
  return { value: text, next: i };
}

function parseYaml(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = /^([A-Za-z0-9_\-]+):(?:\s+(.*))?$/.exec(line);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = (m[2] || '').trim();
    if (/^[|>][+-]?$/.test(rest)) {
      const r = readBlock(lines, i + 1, rest);
      out[key] = r.value;
      i = r.next;
    } else if (rest === '') {
      // Либо список ниже, либо пустое значение
      const items = [];
      let j = i + 1;
      while (j < lines.length) {
        const lm = /^\s*-\s*(.*)$/.exec(lines[j]);
        if (!lm) break;
        const itemRaw = lm[1];
        if (/^[|>][+-]?$/.test(itemRaw.trim())) {
          const r = readBlock(lines, j + 1, itemRaw.trim());
          items.push(r.value);
          j = r.next;
        } else {
          items.push(parseScalar(itemRaw));
          j++;
        }
      }
      out[key] = items.length ? items : null;
      i = j;
    } else {
      out[key] = parseScalar(rest);
      i++;
    }
  }
  return out;
}

/** Файл .md -> { data: {…front matter…}, body: 'текст' } */
function parseMarkdownFile(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(clean);
  if (!m) return { data: {}, body: clean.trim() };
  return { data: parseYaml(m[1]), body: m[2].trim() };
}

/* ---------- Чтение коллекций ---------- */

function readCollection(dir) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((file) => {
      const { data, body } = parseMarkdownFile(fs.readFileSync(path.join(full, file), 'utf8'));
      // slug берём из поля, а если его нет — из имени файла
      data.slug = data.slug || file.replace(/\.md$/, '');
      data.body = body;
      return data;
    });
}

const toList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

/* Категории: сортировка по полю order */
const categories = readCollection('categories')
  .map((c) => ({
    slug: String(c.slug),
    title: c.title || c.slug,
    short_title: c.short_title || '',
    parent: c.parent || '',
    order: Number.isFinite(c.order) ? c.order : 100,
    color: c.color || '',
    placeholder: c.placeholder || 'ww2',
    description: c.description || ''
  }))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));

/* Теги */
const tags = readCollection('tags')
  .map((t) => ({ slug: String(t.slug), title: t.title || t.slug, description: t.description || '' }))
  .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

/* Экспонаты: сортировка по номеру (как число) */
const exhibits = readCollection('exhibits')
  .map((e) => ({
    number: String(e.number == null ? e.slug : e.number),
    title: e.title || '',
    category: e.category || '',
    tags: toList(e.tags).map(String),
    body: e.body || '',
    image: e.image || '',
    gallery: toList(e.gallery).map(String),
    video_url: e.video_url || '',
    featured: e.featured === true
  }))
  .sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0) || a.number.localeCompare(b.number, 'ru'));

/* ---------- Проверки: предупреждаем, но не роняем сборку ---------- */
const catSlugs = new Set(categories.map((c) => c.slug));
const tagSlugs = new Set(tags.map((t) => t.slug));
exhibits.forEach((e) => {
  if (e.category && !catSlugs.has(e.category)) console.warn(`⚠ Экспонат №${e.number}: категория «${e.category}» не найдена`);
  e.tags.forEach((t) => { if (!tagSlugs.has(t)) console.warn(`⚠ Экспонат №${e.number}: тег «${t}» не найден`); });
});

/* ---------- Запись ---------- */
const write = (name, data) => fs.writeFileSync(path.join(CONTENT, name), JSON.stringify(data, null, 1) + '\n');
write('categories.json', categories);
write('tags.json', tags);
write('exhibits.json', exhibits);

console.log(`Готово: категорий — ${categories.length}, тегов — ${tags.length}, экспонатов — ${exhibits.length}`);
