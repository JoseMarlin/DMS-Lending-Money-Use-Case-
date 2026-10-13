import { render, screen } from '@testing-library/react';
import { CheckStatus } from '@/data/types';
import KycCheckRow from './KycCheckRow';

const base = {
  title: 'PAN',
  description: 'PAN ABCPP1234F, checked with the Income Tax Department',
};

describe('KycCheckRow retry wording', () => {
  it('says "Trying again" while another try is still to come, even on the last retry', () => {
    render(<KycCheckRow {...base} status={CheckStatus.Unavailable} retries={3} final={false} />);
    expect(screen.getByText('Source not available. Trying again (3 of 3).')).toBeInTheDocument();
    expect(screen.queryByText(/still not available/)).not.toBeInTheDocument();
  });

  it('says it gave up only when the retries are used up', () => {
    render(<KycCheckRow {...base} status={CheckStatus.Unavailable} retries={3} final />);
    expect(
      screen.getByText('Source still not available after 3 retries. This counts as an exception.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Trying again/)).not.toBeInTheDocument();
  });

  it('shows neither for a source that answered', () => {
    render(<KycCheckRow {...base} status={CheckStatus.Verified} />);
    expect(screen.queryByText(/Trying again|still not available/)).not.toBeInTheDocument();
  });

  it('gives each badge the same minimum width, so a check does not change size', () => {
    render(<KycCheckRow {...base} status={CheckStatus.Checking} durationMs={100} />);
    expect(screen.getByText('Checking').closest('span')).toHaveClass('min-w-[104px]');
  });
});
