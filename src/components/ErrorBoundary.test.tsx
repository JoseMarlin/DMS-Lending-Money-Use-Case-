import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '@/data/store';
import ErrorBoundary from './ErrorBoundary';

let broken = true;

function Page() {
  if (broken) throw new Error('boom: Aadhaar 234500074821');
  return <p>The page</p>;
}

beforeEach(() => {
  broken = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('shows the page when nothing is wrong', () => {
    broken = false;
    render(
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>,
    );
    expect(screen.getByText('The page')).toBeInTheDocument();
  });

  it('shows a message and a way out instead of a blank screen, without the error text', () => {
    render(
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on this page');
    expect(alert).not.toHaveTextContent('boom');
    expect(alert).not.toHaveTextContent('234500074821');
  });

  it('Reset demo brings back the sample data and the page', () => {
    useAppStore.getState().fillScenario('A');
    render(
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>,
    );
    broken = false; // what broke it is gone once the data is reset
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(useAppStore.getState().activeScenario).toBeNull();
    expect(screen.getByText('The page')).toBeInTheDocument();
  });

  it('clears the error when the address changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/apply">
        <Page />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    broken = false;
    rerender(
      <ErrorBoundary resetKey="/demo/components">
        <Page />
      </ErrorBoundary>,
    );
    expect(screen.getByText('The page')).toBeInTheDocument();
  });
});
