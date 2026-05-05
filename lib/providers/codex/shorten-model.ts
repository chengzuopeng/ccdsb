function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const FAMILY_LABEL: Record<string, string> = {
  mini: 'Mini',
  nano: 'Nano',
  pro: 'Pro',
  turbo: 'Turbo',
  preview: 'Preview',
};

export function shortenCodexModel(model: string): string {
  if (!model) return '(unknown)';
  const m = model.replace(/^openai\//, '');
  if (m.toLowerCase().startsWith('gpt-')) {
    const rest = m.slice(4);
    const parts = rest.split('-').map((p) => FAMILY_LABEL[p.toLowerCase()] ?? p);
    return 'GPT-' + parts.join(' ');
  }
  if (m.toLowerCase().startsWith('o')) {
    return m.toUpperCase();
  }
  return capitalize(m.replace(/-/g, ' '));
}
