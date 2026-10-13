import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('routes', () => {
  it('renders the apply page', () => {
    render(
      <MemoryRouter initialEntries={['/apply']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Home Loan Application' })).toBeInTheDocument();
  });

  it('sends an unknown address to the dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/nothing/here']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('opens the dashboard from the root address', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the components page', () => {
    render(
      <MemoryRouter initialEntries={['/demo/components']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Components' })).toBeInTheDocument();
  });
});
