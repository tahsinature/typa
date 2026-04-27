import { registerTransform } from './registry';

function parseRow(line: string): string[] {
  // Replace escaped pipes with placeholder
  const escaped = line.replace(/\\\|/g, '\x00');
  const cells = escaped.split('|').map(c => c.replace(/\x00/g, '|').trim());
  // Remove empty leading/trailing from outer pipes
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?$/.test(line.trim());
}

function smartValue(cell: string): string | number {
  if (cell === '') return '';
  const num = Number(cell);
  if (!isNaN(num) && cell.trim() !== '') return num;
  return cell;
}

function parseMarkdownTable(input: string): Record<string, string | number>[] {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Not a valid markdown table (need at least 2 rows)');

  const headers = parseRow(lines[0]);
  if (headers.length === 0) throw new Error('No headers found');

  // Detect and skip separator row
  let dataStart = 1;
  if (lines.length > 1 && isSeparatorRow(lines[1])) {
    dataStart = 2;
  }

  if (dataStart >= lines.length) throw new Error('No data rows found');

  const rows: Record<string, string | number>[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const row: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = smartValue(cells[j] ?? '');
    }
    rows.push(row);
  }

  return rows;
}

registerTransform({
  id: 'markdown-table',
  name: 'Markdown Table',
  description: 'Parse and render a markdown table',
  category: 'Formatting',
  inputViews: ['raw-input'],
  outputViews: ['table', 'json-diagram', 'raw-output'],
  fn: (input: string) => JSON.stringify(parseMarkdownTable(input)),
});
