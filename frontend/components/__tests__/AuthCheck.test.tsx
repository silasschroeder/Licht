import { render, screen, fireEvent } from '@testing-library/react';
import AuthCheck from '../AuthCheck';

// Mock fetch
global.fetch = jest.fn();

describe('AuthCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when authenticated', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true }),
    });

    render(
      <AuthCheck>
        <div>Protected Content</div>
      </AuthCheck>
    );

    // Wait for auth check
    await screen.findByText('Protected Content');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects when not authenticated', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
    });

    const { container } = render(
      <AuthCheck>
        <div>Protected Content</div>
      </AuthCheck>
    );

    // Should not render protected content
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { container } = render(
      <AuthCheck>
        <div>Protected Content</div>
      </AuthCheck>
    );

    // Should not immediately show content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
