// Unit tests for the escrow ledger invariant + split helpers.
//
// These tests run in-process and do NOT touch Prisma; they exercise
// the pure-function helpers (checkBalance, splitWorkloadPayment,
// refundFromEscrow). The persistence path is exercised in
// integration tests that hit a real DB.
//
// Why test these specifically: the invariant is the single most
// important correctness property in the whole commercial build. If
// splitWorkloadPayment ever rounds wrong or checkBalance ever misses
// an imbalance, we're losing or creating money out of thin air.

import { describe, it, expect } from 'vitest';
import {
  checkBalance,
  splitWorkloadPayment,
  refundFromEscrow,
} from '@/lib/billing/escrow-ledger';

describe('escrow-ledger: checkBalance', () => {
  it('returns zero for a balanced entry', () => {
    const entry = {
      eventType: 'BUYER_DEPOSIT' as const,
      groupId: 'test-1',
      legs: [
        {
          account: 'OPERATIONAL_CASH' as const,
          direction: 'DEBIT' as const,
          amountUsdCents: BigInt(1000),
        },
        {
          account: 'BUYER_WALLET' as const,
          direction: 'CREDIT' as const,
          amountUsdCents: BigInt(1000),
          subjectUserId: 'user_1',
        },
      ],
    };
    expect(checkBalance(entry)).toBe(BigInt(0));
  });

  it('returns positive imbalance when debits exceed credits', () => {
    const entry = {
      eventType: 'BUYER_DEPOSIT' as const,
      groupId: 'test-2',
      legs: [
        { account: 'OPERATIONAL_CASH' as const, direction: 'DEBIT' as const, amountUsdCents: BigInt(1000) },
        { account: 'BUYER_WALLET' as const, direction: 'CREDIT' as const, amountUsdCents: BigInt(900) },
      ],
    };
    expect(checkBalance(entry)).toBe(BigInt(100));
  });

  it('returns negative imbalance when credits exceed debits', () => {
    const entry = {
      eventType: 'BUYER_DEPOSIT' as const,
      groupId: 'test-3',
      legs: [
        { account: 'OPERATIONAL_CASH' as const, direction: 'DEBIT' as const, amountUsdCents: BigInt(900) },
        { account: 'BUYER_WALLET' as const, direction: 'CREDIT' as const, amountUsdCents: BigInt(1000) },
      ],
    };
    expect(checkBalance(entry)).toBe(BigInt(-100));
  });

  it('rejects negative leg amounts', () => {
    const entry = {
      eventType: 'ADJUSTMENT' as const,
      groupId: 'test-4',
      legs: [
        { account: 'OPERATIONAL_CASH' as const, direction: 'DEBIT' as const, amountUsdCents: BigInt(-100) },
      ],
    };
    expect(() => checkBalance(entry)).toThrow(/non-negative/);
  });

  it('handles many-leg entries', () => {
    const entry = {
      eventType: 'WORKLOAD_COMPLETE' as const,
      groupId: 'test-5',
      legs: [
        { account: 'ESCROW_HELD' as const, direction: 'DEBIT' as const, amountUsdCents: BigInt(10_000) },
        { account: 'OPERATOR_PENDING' as const, direction: 'CREDIT' as const, amountUsdCents: BigInt(8_700) },
        { account: 'PLATFORM_FEE' as const, direction: 'CREDIT' as const, amountUsdCents: BigInt(1_000) },
        { account: 'RESERVE_FUND' as const, direction: 'CREDIT' as const, amountUsdCents: BigInt(300) },
      ],
    };
    expect(checkBalance(entry)).toBe(BigInt(0));
  });
});

describe('escrow-ledger: splitWorkloadPayment', () => {
  it('splits 10,000 cents into 8700 + 1000 + 300 (87/10/3)', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt(10_000),
      buyerUserId: 'user_1',
      operatorId: 'op_1',
      settlementRecordId: 'settle_1',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));

    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    const feeLeg = entry.legs.find((l) => l.account === 'PLATFORM_FEE');
    const reserveLeg = entry.legs.find((l) => l.account === 'RESERVE_FUND');

    expect(operatorLeg?.amountUsdCents).toBe(BigInt(8700));
    expect(feeLeg?.amountUsdCents).toBe(BigInt(1000));
    expect(reserveLeg?.amountUsdCents).toBe(BigInt(300));
  });

  it('gives the remainder to the operator so buyer is never overcharged', () => {
    // 7 cents is a pathological small amount where 10% and 3% both
    // round down to zero. Operator should get the whole 7 cents.
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt(7),
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));

    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    const feeLeg = entry.legs.find((l) => l.account === 'PLATFORM_FEE');
    const reserveLeg = entry.legs.find((l) => l.account === 'RESERVE_FUND');
    expect(operatorLeg?.amountUsdCents).toBe(BigInt(7));
    expect(feeLeg?.amountUsdCents).toBe(BigInt(0));
    expect(reserveLeg?.amountUsdCents).toBe(BigInt(0));
  });

  it('rejects zero and negative totals', () => {
    expect(() =>
      splitWorkloadPayment({
        totalUsdCents: BigInt(0),
        buyerUserId: 'u',
        operatorId: 'o',
        settlementRecordId: 's',
      }),
    ).toThrow(/positive/);
  });

  it('handles large amounts without precision loss', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt('1000000000000'),  // $10M
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));
    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    const feeLeg = entry.legs.find((l) => l.account === 'PLATFORM_FEE');
    const reserveLeg = entry.legs.find((l) => l.account === 'RESERVE_FUND');
    expect(feeLeg?.amountUsdCents).toBe(BigInt('100000000000'));
    expect(reserveLeg?.amountUsdCents).toBe(BigInt('30000000000'));
    expect(operatorLeg?.amountUsdCents).toBe(BigInt('870000000000'));
  });
});

describe('escrow-ledger: splitWorkloadPayment ATTESTED tier', () => {
  it('splits 10,000 cents into 9200 + 500 + 300 (92/5/3)', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt(10_000),
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
      tier: 'ATTESTED',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));

    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    const feeLeg = entry.legs.find((l) => l.account === 'PLATFORM_FEE');
    const reserveLeg = entry.legs.find((l) => l.account === 'RESERVE_FUND');

    expect(operatorLeg?.amountUsdCents).toBe(BigInt(9200));
    expect(feeLeg?.amountUsdCents).toBe(BigInt(500));
    expect(reserveLeg?.amountUsdCents).toBe(BigInt(300));
  });

  it('operator gets the remainder on pathological small amounts', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt(7),
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
      tier: 'ATTESTED',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));
    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    expect(operatorLeg?.amountUsdCents).toBe(BigInt(7));
  });

  it('tags the entry memo so audit trails show the tier', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt(1_000),
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
      tier: 'ATTESTED',
    });
    expect(entry.memo).toContain('Attested-operator split');
  });

  it('large-amount precision holds for the 92/5/3 split', () => {
    const entry = splitWorkloadPayment({
      totalUsdCents: BigInt('1000000000000'),
      buyerUserId: 'u',
      operatorId: 'o',
      settlementRecordId: 's',
      tier: 'ATTESTED',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));
    const feeLeg = entry.legs.find((l) => l.account === 'PLATFORM_FEE');
    const reserveLeg = entry.legs.find((l) => l.account === 'RESERVE_FUND');
    const operatorLeg = entry.legs.find((l) => l.account === 'OPERATOR_PENDING');
    expect(feeLeg?.amountUsdCents).toBe(BigInt('50000000000'));
    expect(reserveLeg?.amountUsdCents).toBe(BigInt('30000000000'));
    expect(operatorLeg?.amountUsdCents).toBe(BigInt('920000000000'));
  });
});

describe('escrow-ledger: refundFromEscrow', () => {
  it('balances a simple buyer refund without reserve drawdown', () => {
    const entry = refundFromEscrow({
      amountUsdCents: BigInt(5000),
      buyerUserId: 'user_1',
      disputeId: 'disp_1',
      settlementRecordId: 'settle_1',
    });
    expect(checkBalance(entry)).toBe(BigInt(0));
    expect(entry.legs).toHaveLength(2);
  });

  it('adds reserve drawdown legs when requested', () => {
    const entry = refundFromEscrow({
      amountUsdCents: BigInt(5000),
      buyerUserId: 'user_1',
      disputeId: 'disp_1',
      settlementRecordId: 'settle_1',
      drawdownFromReserve: true,
    });
    expect(checkBalance(entry)).toBe(BigInt(0));
    expect(entry.legs).toHaveLength(4);
    expect(entry.legs.some((l) => l.account === 'RESERVE_FUND' && l.direction === 'DEBIT')).toBe(true);
    expect(entry.legs.some((l) => l.account === 'DISPUTE_REFUND' && l.direction === 'CREDIT')).toBe(true);
  });
});
