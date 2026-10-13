import { fireEvent, render, screen } from '@testing-library/react';
import { createBlankApplication } from '@/data/application';
import { OCCUPATIONS } from '@/data/options';
import SectionBlock from './SectionBlock';
import type { SectionSchema } from './schema';

/** A small section of its own, so these tests do not change when the real schema grows */
const SAMPLE: SectionSchema = {
  id: 'applicant',
  title: 'Applicant',
  fields: [
    { key: 'fullNameAsPerPan', label: 'Full Name (as per PAN)', type: 'text', required: true },
    {
      key: 'occupation',
      label: 'Occupation',
      type: 'dropdown',
      required: true,
      options: OCCUPATIONS,
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      type: 'text',
      uppercase: true,
      visibleWhen: (v) => v.occupation === 'Business' || v.occupation === 'Professional',
    },
  ],
};

const values = (overrides = {}) => ({
  ...createBlankApplication({ applicationId: 'HL-2026-0008', branch: 'b', createdBy: 'u' }),
  ...overrides,
});

describe('SectionBlock', () => {
  it('renders the heading and the visible fields with labels', () => {
    render(<SectionBlock section={SAMPLE} values={values()} onChange={() => {}} />);
    expect(screen.getByRole('heading', { level: 2, name: /^Applicant/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name \(as per PAN\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Occupation/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/GSTIN/)).not.toBeInTheDocument();
  });

  it('shows a red asterisk on required fields', () => {
    render(<SectionBlock section={SAMPLE} values={values()} onChange={() => {}} />);
    expect(screen.getByText('Full Name (as per PAN)').textContent).toContain('*');
    expect(screen.getByLabelText(/Full Name/)).toBeRequired();
  });

  it('shows the conditional field when its condition is met', () => {
    render(
      <SectionBlock
        section={SAMPLE}
        values={values({ occupation: 'Business' })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/GSTIN/)).toBeInTheDocument();
  });

  it('lists the occupation options from the data layer', () => {
    render(<SectionBlock section={SAMPLE} values={values()} onChange={() => {}} />);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Select', 'Salaried', 'Business', 'Professional', 'Agriculturist']);
  });

  it('calls onChange with the field and the typed or chosen value', () => {
    const onChange = vi.fn();
    render(<SectionBlock section={SAMPLE} values={values()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Anita Desai' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'fullNameAsPerPan' }),
      'Anita Desai',
    );
    fireEvent.change(screen.getByLabelText(/Occupation/), { target: { value: 'Salaried' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'occupation' }),
      'Salaried',
    );
  });

  it('shows an error under the field in red and marks it invalid', () => {
    render(
      <SectionBlock
        section={SAMPLE}
        values={values()}
        errors={{ fullNameAsPerPan: 'Enter the name as on the PAN' }}
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText(/Full Name/);
    expect(input).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the name as on the PAN');
    expect(input).toHaveAccessibleDescription('Enter the name as on the PAN');
  });

  it('renders readOnly and calculated fields as disabled', () => {
    const section: SectionSchema = {
      id: 'x',
      title: 'Property',
      fields: [
        { key: 'applicationId', label: 'Application ID', type: 'text', readOnly: true },
        { key: 'eligibleAmount', label: 'Eligible Amount', type: 'number', calculated: true },
      ],
    };
    render(
      <SectionBlock
        section={section}
        values={values({ eligibleAmount: 1950000 })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Application ID')).toBeDisabled();
    expect(screen.getByLabelText('Application ID')).toHaveValue('HL-2026-0008');
    expect(screen.getByLabelText('Eligible Amount')).toBeDisabled();
    expect(screen.getByLabelText('Eligible Amount')).toHaveValue('19,50,000');
  });

  it('renders a multi line field as a textarea', () => {
    const section: SectionSchema = {
      id: 'x',
      title: 'Applicant',
      fields: [{ key: 'address', label: 'Address', type: 'multiLine' }],
    };
    render(<SectionBlock section={section} values={values()} onChange={() => {}} />);
    expect(screen.getByLabelText('Address').tagName).toBe('TEXTAREA');
  });

  it('renders nothing when no field in the section is visible', () => {
    const section: SectionSchema = {
      id: 'x',
      title: 'Hidden',
      fields: [{ key: 'gstin', label: 'GSTIN', type: 'text', visibleWhen: () => false }],
    };
    const { container } = render(
      <SectionBlock section={section} values={values()} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('turns typed text into capitals when the field is uppercase', () => {
    const onChange = vi.fn();
    render(
      <SectionBlock
        section={SAMPLE}
        values={values({ occupation: 'Business' })}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/GSTIN/), { target: { value: '29abcpp1234f1z5' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'gstin' }),
      '29ABCPP1234F1Z5',
    );
  });

  it('shows numbers with Indian grouping and reports plain digits', () => {
    const onChange = vi.fn();
    const section: SectionSchema = {
      id: 'x',
      title: 'Application',
      fields: [{ key: 'loanAmountRequested', label: 'Loan Amount Requested', type: 'number' }],
    };
    render(
      <SectionBlock
        section={section}
        values={values({ loanAmountRequested: 1800000 })}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Loan Amount Requested');
    expect(input).toHaveValue('18,00,000');
    fireEvent.change(input, { target: { value: '18,00,0000' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'loanAmountRequested' }),
      '18000000',
    );
  });

  it('shows a date as DD/MM/YYYY and reports an ISO date once it is complete', () => {
    const onChange = vi.fn();
    const section: SectionSchema = {
      id: 'x',
      title: 'Applicant',
      fields: [{ key: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true }],
    };
    render(
      <SectionBlock
        section={section}
        values={values({ dateOfBirth: '1984-03-14' })}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/Date of Birth/);
    expect(input).toHaveValue('14/03/1984');
    fireEvent.change(input, { target: { value: '15031984' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'dateOfBirth' }),
      '1984-03-15',
    );
  });
});
