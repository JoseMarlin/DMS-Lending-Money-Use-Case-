import { SCENARIOS, SCENARIO_KEYS, SEED_APPLICATIONS } from '@/data/seed';
import type { ScenarioKey } from '@/data/types';
import {
  duplicatePanMessage,
  eligibleAmountMessage,
  isValidGstStateCode,
  MESSAGES,
  validateAadhaar,
  validateAge,
  validateDuplicatePan,
  validateEmail,
  validateGstin,
  validateLoanAmount,
  validateMaskedAadhaar,
  validateMobile,
  validateOwnerName,
  validatePan,
  validatePinCode,
  validateTenure,
} from './rules';

const A = SCENARIOS.A.application;
const B = SCENARIOS.B.application;
const C = SCENARIOS.C.application;
const TODAY = '2026-10-08';
const scenario = (key: ScenarioKey) => SCENARIOS[key].application;

describe('messages (section 7)', () => {
  it('uses the exact text from the overview', () => {
    expect(MESSAGES.pan).toBe('Enter a valid PAN, for example ABCPP1234F');
    expect(MESSAGES.gstin).toBe('GSTIN does not match the PAN entered');
    expect(MESSAGES.aadhaar).toBe('Enter a valid 12-digit Aadhaar');
    expect(MESSAGES.mobile).toBe('Enter a valid mobile number');
    expect(MESSAGES.age).toBe('Applicant age must be between 18 and 55');
    expect(MESSAGES.maxLoan).toBe('Maximum home loan is 30,00,000');
    expect(MESSAGES.tenure).toBe('Maximum tenure is 240 months');
    expect(MESSAGES.ownerName).toBe("Property must be in the applicant's name");
    expect(eligibleAmountMessage(1_950_000)).toBe(
      'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    );
    expect(duplicatePanMessage('HL-2026-0003')).toBe(
      'An application for this PAN already exists: HL-2026-0003',
    );
  });
});

describe('validatePan', () => {
  it.each(SCENARIO_KEYS)('accepts the PAN of scenario %s', (key) => {
    expect(validatePan(scenario(key).pan!)).toBeNull();
  });

  it('accepts the PANs of the sureties and the seeded applications', () => {
    SCENARIO_KEYS.forEach((key) => {
      expect(validatePan(scenario(key).surety1Pan!)).toBeNull();
      expect(validatePan(scenario(key).surety2Pan!)).toBeNull();
    });
    SEED_APPLICATIONS.forEach((a) => expect(validatePan(a.pan)).toBeNull());
  });

  it('accepts lower case and spaces around it', () => {
    expect(validatePan('abcpp1234f')).toBeNull();
    expect(validatePan(' ABCPP1234F ')).toBeNull();
  });

  it('requires the 4th letter to be P (an individual)', () => {
    expect(validatePan('ABCDE1234F')).toBe(MESSAGES.pan);
    expect(validatePan('ABCCP1234F')).toBe(MESSAGES.pan); // C = company
    expect(validatePan('ABCHP1234F')).toBe(MESSAGES.pan); // H = HUF
  });

  it.each([
    'ABCPP1234', // too short
    'ABCPP1234FF', // too long
    '1BCPP1234F', // digit where a letter is needed
    'ABCPP12A4F', // letter where a digit is needed
    'ABCPP12345', // digit where the last letter is needed
    'ABC-P1234F',
    'ABCPP 1234F',
  ])('rejects %s', (pan) => {
    expect(validatePan(pan)).toBe(MESSAGES.pan);
  });

  it('leaves an empty value to the required check', () => {
    expect(validatePan('')).toBeNull();
    expect(validatePan('   ')).toBeNull();
  });
});

describe('validateGstin', () => {
  it('accepts the GSTIN of scenario A for its PAN', () => {
    expect(validateGstin(A.gstin!, A.pan!)).toBeNull();
  });

  it('accepts the GSTINs of the seeded business applicants', () => {
    SEED_APPLICATIONS.filter((a) => a.gstin).forEach((a) => {
      expect(validateGstin(a.gstin, a.pan)).toBeNull();
    });
  });

  it('accepts lower case', () => {
    expect(validateGstin('29abcpp1234f1z5', 'ABCPP1234F')).toBeNull();
  });

  it('rejects a GSTIN that holds another PAN (scenario A GSTIN against scenarios B and C)', () => {
    expect(validateGstin(A.gstin!, B.pan!)).toBe(MESSAGES.gstin);
    expect(validateGstin(A.gstin!, C.pan!)).toBe(MESSAGES.gstin);
  });

  it('only checks the structure while no PAN has been entered', () => {
    expect(validateGstin(A.gstin!, '')).toBeNull();
    expect(validateGstin('29ABCPP1234F1Z', '')).toBe(MESSAGES.gstin);
  });

  it.each([
    ['too short', '29ABCPP1234F1Z'],
    ['too long', '29ABCPP1234F1Z55'],
    ['no state code', 'XXABCPP1234F1Z5'],
    ['14th character is not Z', '29ABCPP1234F1A5'],
    ['entity code 0', '29ABCPP1234F0Z5'],
    ['spaces', '29ABCPP1234F 1Z5'],
  ])('rejects a GSTIN that is %s', (_name, gstin) => {
    expect(validateGstin(gstin, 'ABCPP1234F')).toBe(MESSAGES.gstin);
  });

  it('rejects state codes that do not exist', () => {
    expect(validateGstin('00ABCPP1234F1Z5', 'ABCPP1234F')).toBe(MESSAGES.gstin);
    expect(validateGstin('39ABCPP1234F1Z5', 'ABCPP1234F')).toBe(MESSAGES.gstin);
    expect(validateGstin('98ABCPP1234F1Z5', 'ABCPP1234F')).toBe(MESSAGES.gstin);
  });

  it('knows the state codes: 01 to 38, 97 and 99', () => {
    ['01', '09', '29', '36', '37', '38', '97', '99'].forEach((c) => {
      expect(isValidGstStateCode(c)).toBe(true);
    });
    ['00', '39', '50', '96', '98', 'AB', '2', '290'].forEach((c) => {
      expect(isValidGstStateCode(c)).toBe(false);
    });
  });

  it('leaves an empty GSTIN alone (the format rule does not run; "Enter GSTIN" is the required check)', () => {
    expect(validateGstin('', 'ABCPP1234F')).toBeNull();
  });
});

describe('Aadhaar', () => {
  it.each(SCENARIO_KEYS)('accepts the dummy number of scenario %s', (key) => {
    expect(validateAadhaar(SCENARIOS[key].aadhaarInput)).toBeNull();
  });

  it('accepts a number with spaces', () => {
    expect(validateAadhaar('2345 0007 4821')).toBeNull();
  });

  it('rejects a wrong check digit (Verhoeff), wrong length and letters', () => {
    expect(validateAadhaar('234500074822')).toBe(MESSAGES.aadhaar);
    expect(validateAadhaar('234500037734')).toBe(MESSAGES.aadhaar);
    expect(validateAadhaar('23450007482')).toBe(MESSAGES.aadhaar);
    expect(validateAadhaar('2345000748211')).toBe(MESSAGES.aadhaar);
    expect(validateAadhaar('2345000748ab')).toBe(MESSAGES.aadhaar);
  });

  it('catches a single mistyped digit and a swapped pair in every scenario number', () => {
    SCENARIO_KEYS.forEach((key) => {
      const good = SCENARIOS[key].aadhaarInput;
      for (let i = 0; i < 12; i++) {
        const wrong = String((Number(good[i]) + 1) % 10);
        expect(validateAadhaar(good.slice(0, i) + wrong + good.slice(i + 1))).toBe(
          MESSAGES.aadhaar,
        );
      }
      for (let i = 0; i < 11; i++) {
        if (good[i] === good[i + 1]) continue;
        const swapped = good.slice(0, i) + good[i + 1] + good[i] + good.slice(i + 2);
        expect(validateAadhaar(swapped)).toBe(MESSAGES.aadhaar);
      }
    });
  });

  it('leaves an empty value to the required check', () => {
    expect(validateAadhaar('')).toBeNull();
  });

  it('judges the value kept in the record by its mask', () => {
    expect(validateMaskedAadhaar(A.aadhaar!)).toBeNull(); // XXXX XXXX 4821
    expect(validateMaskedAadhaar(B.aadhaar!)).toBeNull();
    expect(validateMaskedAadhaar(C.aadhaar!)).toBeNull();
    expect(validateMaskedAadhaar('')).toBeNull();
    expect(validateMaskedAadhaar('XXXX XXXX XXXX')).toBe(MESSAGES.aadhaar);
    expect(validateMaskedAadhaar('234500074821')).toBe(MESSAGES.aadhaar);
  });
});

describe('mobile, PIN code and email', () => {
  it.each(SCENARIO_KEYS)('accepts the mobile, PIN and email of scenario %s', (key) => {
    const s = scenario(key);
    expect(validateMobile(s.mobile!)).toBeNull();
    expect(validateMobile(s.surety1Mobile!)).toBeNull();
    expect(validateMobile(s.surety2Mobile!)).toBeNull();
    expect(validatePinCode(s.pinCode!)).toBeNull();
    expect(validateEmail(s.email!)).toBeNull();
  });

  it.each(['987650001', '98765000111', '98765 00011', '+919876500011', 'abcdefghij', '98765000.1'])(
    'rejects the mobile number %s',
    (mobile) => {
      expect(validateMobile(mobile)).toBe(MESSAGES.mobile);
    },
  );

  it('rejects a PIN code that is not 6 digits', () => {
    ['59000', '5900011', 'abcdef', '590 001'].forEach((pin) => {
      expect(validatePinCode(pin)).toBe(MESSAGES.pinCode);
    });
  });

  it('rejects an email without an address and a domain', () => {
    ['ramesh', 'ramesh@', '@example.com', 'ramesh@example', 'ra mesh@example.com'].forEach((e) => {
      expect(validateEmail(e)).toBe(MESSAGES.email);
    });
  });

  it('leaves empty values to the required check', () => {
    expect(validateMobile('')).toBeNull();
    expect(validatePinCode('')).toBeNull();
    expect(validateEmail('')).toBeNull();
  });
});

describe('validateAge (18 to 55 on the application date)', () => {
  it.each(SCENARIO_KEYS)('accepts the applicant of scenario %s', (key) => {
    expect(validateAge(scenario(key).dateOfBirth!, TODAY)).toBeNull();
  });

  it('accepts exactly 18 and exactly 55', () => {
    expect(validateAge('2008-10-08', TODAY)).toBeNull(); // 18 today
    expect(validateAge('1971-10-08', TODAY)).toBeNull(); // 55 today
    expect(validateAge('1971-10-09', TODAY)).toBeNull(); // 54, turns 55 tomorrow
    expect(validateAge('1970-10-09', TODAY)).toBeNull(); // 55, turns 56 tomorrow
  });

  it('rejects 17 and 56', () => {
    expect(validateAge('2008-10-09', TODAY)).toBe(MESSAGES.age); // 17, turns 18 tomorrow
    expect(validateAge('1970-10-08', TODAY)).toBe(MESSAGES.age); // 56 today
  });

  it('rejects a date of birth in the future and a very old one', () => {
    expect(validateAge('2030-01-01', TODAY)).toBe(MESSAGES.age);
    expect(validateAge('1950-01-01', TODAY)).toBe(MESSAGES.age);
  });

  it('uses the application date, not today', () => {
    expect(validateAge('1971-10-08', '2026-10-07')).toBeNull(); // 54
    expect(validateAge('1971-10-08', '2027-10-08')).toBe(MESSAGES.age); // 56
  });

  it('leaves an empty or incomplete date to the required check', () => {
    expect(validateAge('', TODAY)).toBeNull();
    expect(validateAge('1984-03', TODAY)).toBeNull();
  });
});

describe('validateLoanAmount', () => {
  const ctx = (key: ScenarioKey) => ({
    loanPurpose: scenario(key).loanPurpose!,
    eligibleAmount: scenario(key).eligibleAmount!,
  });

  it.each(SCENARIO_KEYS)('accepts the amount requested in scenario %s', (key) => {
    expect(validateLoanAmount(scenario(key).loanAmountRequested!, ctx(key))).toBeNull();
  });

  it('scenario A: 22,00,000 exceeds 75% of the estimate', () => {
    expect(validateLoanAmount(2_200_000, ctx('A'))).toBe(
      'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    );
  });

  it('scenario A: exactly the eligible amount is fine, one rupee more is not', () => {
    expect(validateLoanAmount(1_950_000, ctx('A'))).toBeNull();
    expect(validateLoanAmount(1_950_001, ctx('A'))).toBe(
      'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    );
  });

  it('scenario B: the limit is 12,37,500', () => {
    expect(validateLoanAmount(1_237_500, ctx('B'))).toBeNull();
    expect(validateLoanAmount(1_237_501, ctx('B'))).toBe(
      'Amount exceeds 75% of the estimate. Maximum 12,37,500',
    );
  });

  it('scenario C: the limit is 10,50,000', () => {
    expect(validateLoanAmount(1_050_000, ctx('C'))).toBeNull();
    expect(validateLoanAmount(1_050_001, ctx('C'))).toBe(
      'Amount exceeds 75% of the estimate. Maximum 10,50,000',
    );
  });

  it('the 75% message comes before the 30,00,000 cap', () => {
    expect(validateLoanAmount(3_500_000, ctx('A'))).toBe(
      'Amount exceeds 75% of the estimate. Maximum 19,50,000',
    );
  });

  it('the cap applies on its own when the estimate allows more than 30,00,000', () => {
    const rich = { loanPurpose: 'Construction of house' as const, eligibleAmount: 3_000_000 };
    expect(validateLoanAmount(3_000_000, rich)).toBeNull();
    expect(validateLoanAmount(3_000_001, rich)).toBe('Maximum home loan is 30,00,000');
  });

  it('other purposes only have the cap', () => {
    const flat = { loanPurpose: 'Purchase of flat' as const, eligibleAmount: 3_000_000 };
    expect(validateLoanAmount(2_900_000, flat)).toBeNull();
    expect(validateLoanAmount(3_000_000, flat)).toBeNull();
    expect(validateLoanAmount(3_000_001, flat)).toBe('Maximum home loan is 30,00,000');
  });

  it('only has the cap before the estimate or the purpose is known', () => {
    const noCost = { loanPurpose: 'Construction of house' as const, eligibleAmount: null };
    const noPurpose = { loanPurpose: '' as const, eligibleAmount: null };
    expect(validateLoanAmount(2_500_000, noCost)).toBeNull();
    expect(validateLoanAmount(3_100_000, noCost)).toBe('Maximum home loan is 30,00,000');
    expect(validateLoanAmount(3_100_000, noPurpose)).toBe('Maximum home loan is 30,00,000');
  });

  it('leaves an empty or zero amount to the required check', () => {
    expect(validateLoanAmount(null, ctx('A'))).toBeNull();
    expect(validateLoanAmount(0, ctx('A'))).toBeNull();
  });
});

describe('validateTenure', () => {
  it.each(SCENARIO_KEYS)('accepts the tenure of scenario %s', (key) => {
    expect(validateTenure(scenario(key).tenureMonths!)).toBeNull();
  });

  it('accepts 240 months and rejects 241', () => {
    expect(validateTenure(240)).toBeNull();
    expect(validateTenure(241)).toBe('Maximum tenure is 240 months');
    expect(validateTenure(600)).toBe('Maximum tenure is 240 months');
  });

  it('leaves an empty or zero tenure to the required check', () => {
    expect(validateTenure(null)).toBeNull();
    expect(validateTenure(0)).toBeNull();
  });
});

describe('validateOwnerName', () => {
  it.each(SCENARIO_KEYS)('accepts the owner in scenario %s (same as the applicant)', (key) => {
    const s = scenario(key);
    expect(validateOwnerName(s.propertyOwnerName!, s.fullNameAsPerPan!)).toBeNull();
  });

  it('ignores case, extra spaces and full stops', () => {
    expect(validateOwnerName('RAMESH  PATIL', 'Ramesh Patil')).toBeNull();
    expect(validateOwnerName(' ramesh patil ', 'Ramesh Patil')).toBeNull();
    expect(validateOwnerName('Anita R. Desai', 'Anita R Desai')).toBeNull();
  });

  it('rejects another person, also with the surname alone or an extra name', () => {
    expect(validateOwnerName('Suresh Patil', 'Ramesh Patil')).toBe(MESSAGES.ownerName);
    expect(validateOwnerName('Patil', 'Ramesh Patil')).toBe(MESSAGES.ownerName);
    expect(validateOwnerName('Ramesh K Patil', 'Ramesh Patil')).toBe(MESSAGES.ownerName);
  });

  it("rejects the other scenarios' applicants", () => {
    expect(validateOwnerName(B.fullNameAsPerPan!, A.fullNameAsPerPan!)).toBe(MESSAGES.ownerName);
  });

  it('says nothing while either name is empty', () => {
    expect(validateOwnerName('', 'Ramesh Patil')).toBeNull();
    expect(validateOwnerName('Ramesh Patil', '')).toBeNull();
    expect(validateOwnerName('...', 'Ramesh Patil')).toBeNull();
  });
});

describe('validateDuplicatePan', () => {
  const saved = [
    ...SEED_APPLICATIONS,
    { applicationId: 'HL-2026-0008', pan: A.pan! },
    { applicationId: 'HL-2026-0009', pan: B.pan! },
  ];

  it('finds an existing application with the same PAN and names it', () => {
    expect(validateDuplicatePan(A.pan!, saved, 'HL-2026-0010')).toBe(
      'An application for this PAN already exists: HL-2026-0008',
    );
    expect(validateDuplicatePan(B.pan!, saved, 'HL-2026-0010')).toBe(
      'An application for this PAN already exists: HL-2026-0009',
    );
  });

  it('finds a seeded application too', () => {
    expect(validateDuplicatePan(SEED_APPLICATIONS[0].pan, saved, 'HL-2026-0010')).toBe(
      'An application for this PAN already exists: HL-2026-0001',
    );
  });

  it('does not count the application being filled in', () => {
    expect(validateDuplicatePan(A.pan!, saved, 'HL-2026-0008')).toBeNull();
  });

  it('is fine for a PAN nobody has used, and for scenario C on the seeded data', () => {
    expect(validateDuplicatePan(C.pan!, saved, 'HL-2026-0010')).toBeNull();
    SCENARIO_KEYS.forEach((key) => {
      expect(
        validateDuplicatePan(scenario(key).pan!, SEED_APPLICATIONS, 'HL-2026-0008'),
      ).toBeNull();
    });
  });

  it('ignores case and does not judge a PAN that is not valid or empty', () => {
    expect(validateDuplicatePan(A.pan!.toLowerCase(), saved, 'HL-2026-0010')).not.toBeNull();
    expect(validateDuplicatePan('', saved, 'HL-2026-0010')).toBeNull();
    expect(validateDuplicatePan('NOTAPAN', saved, 'HL-2026-0010')).toBeNull();
  });
});
