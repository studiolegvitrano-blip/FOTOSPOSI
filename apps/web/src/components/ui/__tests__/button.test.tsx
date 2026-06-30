import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('renderizza con testo', () => {
    render(<Button>Clicca</Button>);
    expect(screen.getByText('Clicca')).toBeInTheDocument();
  });

  it('renderizza come link con asChild', () => {
    render(<Button asChild><a href="/test">Link</a></Button>);
    const link = screen.getByText('Link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/test');
  });

  it('applica variante outline', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByText('Outline');
    expect(btn.className).toContain('border-border');
  });
});
