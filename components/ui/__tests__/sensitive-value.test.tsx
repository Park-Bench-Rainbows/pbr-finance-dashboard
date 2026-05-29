import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SensitiveValue } from '../sensitive-value';

describe('SensitiveValue', () => {
  it('masks the raw value when hidden', () => {
    const html = renderToStaticMarkup(
      <SensitiveValue isRevealed={false} hiddenLabel="Total income hidden" value="$5,000" />
    );

    expect(html).toContain('••••••');
    expect(html).toContain('Total income hidden');
    expect(html).not.toContain('$5,000');
  });

  it('renders the raw value when revealed', () => {
    const html = renderToStaticMarkup(
      <SensitiveValue isRevealed hiddenLabel="Total income hidden" value="$5,000" />
    );

    expect(html).toContain('$5,000');
    expect(html).not.toContain('••••••');
  });
});
