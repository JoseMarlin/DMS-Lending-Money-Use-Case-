import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '@/data/store';
import AadhaarField from './AadhaarField';

const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;

function setup() {
  const onCommit = vi.fn();
  render(<AadhaarField id="aadhaar" name="aadhaar" value="" onCommit={onCommit} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  act(() => input.focus());
  return { input, onCommit };
}

/** What the browser does when a key is typed: the text changes and the caret is somewhere in it. */
function type(input: HTMLInputElement, text: string, caret: number) {
  setNativeValue.call(input, text);
  input.setSelectionRange(caret, caret);
  fireEvent.input(input);
}

beforeEach(() => {
  useAppStore.getState().resetDemo();
});

describe('Aadhaar input', () => {
  it('shows the digits in groups of four while it has focus', () => {
    const { input } = setup();
    type(input, '234500074821', 12);
    expect(input).toHaveValue('2345 0007 4821');
  });

  it('keeps the caret after the same digit when a digit is typed in the middle', () => {
    const { input } = setup();
    type(input, '2345 0007 4821', 14);
    // a 9 typed after the third digit: the groups move, the caret stays after the 9
    type(input, '2349 5 0007 4821', 4);
    expect(input).toHaveValue('2349 5000 7482 1');
    expect(input.selectionStart).toBe(4);
  });

  it('keeps the caret after the same digit when a digit is deleted in the middle', () => {
    const { input } = setup();
    type(input, '2345 0007 4821', 14);
    type(input, '235 0007 4821', 2);
    expect(input).toHaveValue('2350 0074 821');
    expect(input.selectionStart).toBe(2);
  });

  it('keeps a number longer than twelve digits, so it cannot pass as a shorter one', () => {
    const { input, onCommit } = setup();
    type(input, '2345 0007 4821 9', 16);
    expect(input).toHaveValue('2345 0007 4821 9');
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('XXXX XXXX XXXX');
  });

  it('stops at sixteen digits', () => {
    const { input } = setup();
    type(input, '2345000748219999777', 19);
    expect(input).toHaveValue('2345 0007 4821 9999');
  });

  it('passes on only the masked number when the field is left', () => {
    const { input, onCommit } = setup();
    type(input, '234500074821', 12);
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('XXXX XXXX 4821');
    expect(onCommit).not.toHaveBeenCalledWith(expect.stringMatching(/\d{5}/));
  });
});

describe('the number of the active scenario', () => {
  // the record of a filled scenario holds the mask of the scenario's number
  const withScenario = () => {
    useAppStore.getState().fillScenario('A');
    return useAppStore.getState().draft.aadhaar;
  };

  it('is put in the input for the presenter, where the form asks for it (the default)', () => {
    const mask = withScenario();
    render(<AadhaarField id="aadhaar" name="aadhaar" value={mask} onCommit={() => {}} />);
    const input = screen.getByRole<HTMLInputElement>('textbox');
    act(() => input.focus());
    expect(input.value).not.toBe('');
    expect(input.value.replace(/\s/g, '')).toMatch(/^\d{12}$/);
  });

  it('is never put in the input where it is switched off (the record sheet)', () => {
    const mask = withScenario();
    render(
      <AadhaarField
        id="aadhaar"
        name="aadhaar"
        value={mask}
        onCommit={() => {}}
        scenarioPrefill={false}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('textbox');
    act(() => input.focus());
    expect(input.value).toBe('');
    expect(document.body.innerHTML).not.toMatch(/\d{4}\s\d{4}\s\d{4}/);
  });
});
