import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Home page', () => {
  it('renders rule summary pulled from the shared core package', () => {
    render(<Home />);

    expect(screen.getByText(/Build & battle in real time/i)).toBeInTheDocument();
    expect(screen.getByText(/Min players/i)).toBeInTheDocument();
  });
});
