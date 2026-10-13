import { csvCell, downloadCsv, toCsv } from './csv';

describe('csvCell', () => {
  it('leaves plain text and numbers as they are', () => {
    expect(csvCell('Ramesh Patil')).toBe('Ramesh Patil');
    expect(csvCell(1200000)).toBe('1200000');
  });

  it('writes nothing for an empty value', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('wraps a cell that has a comma, a quote or a line break, and doubles the quotes', () => {
    expect(csvCell('Patil, Ramesh')).toBe('"Patil, Ramesh"');
    expect(csvCell('He said "yes"')).toBe('"He said ""yes"""');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('stops a spreadsheet from running a cell as a formula', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@cmd')).toBe("'@cmd");
    // a formula that also needs quotes gets both
    expect(csvCell('=A1,B1')).toBe('"\'=A1,B1"');
  });

  it('does not touch a negative number given as a number', () => {
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF, with a line end at the last row', () => {
    expect(
      toCsv([
        ['Name', 'Amount'],
        ['Anita', 1200000],
      ]),
    ).toBe('Name,Amount\r\nAnita,1200000\r\n');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gives the browser a file with the name, a byte order mark and the text', async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:csv';
    });
    URL.revokeObjectURL = vi.fn();
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      name = this.download;
      expect(this.href).toBe('blob:csv');
    });
    downloadCsv('list.csv', 'a,b\r\n');
    expect(name).toBe('list.csv');
    expect(blob?.type).toContain('text/csv');
    // the first three bytes are the UTF-8 byte order mark (reading the text back would drop it)
    const bytes = new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob?.text()).toBe('a,b\r\n');
    // the temporary link is not left in the page
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
