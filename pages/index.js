import { useState } from 'react';

const fmt = n => '$' + Math.round(n).toLocaleString();
const pct = n => (n * 100).toFixed(1) + '%';

const calcPI = (loan, annualRate, years = 30) => {
  if (!loan || !annualRate) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
};

const PURCHASE_CLOSING = 1864;

const brrrRating = (cf, cashOut) => {
  if (cashOut && cf >= 100) return 'Grand Slam';
  if (cf >= 300) return 'Grand Slam';
  if (cf >= 150) return 'Banger';
  if (cf >= 50)  return 'Strong';
  if (cf >= 0)   return 'Marginal';
  return 'Negative';
};
const brrrColor = r => ({ 'Grand Slam': '#7c3aed', 'Banger': '#16a34a', 'Strong': '#2563eb', 'Marginal': '#d97706', 'Negative': '#dc2626' }[r] || '#6b7280');

const flipRating = profit => {
  if (profit >= 40000) return ['Knockout', '#7c3aed'];
  if (profit >= 20000) return ['Solid', '#16a34a'];
  if (profit >= 10000) return ['Thin', '#d97706'];
  if (profit >= 0)     return ['Marginal', '#f59e0b'];
  return ['Loser', '#dc2626'];
};

export default function Home() {
  const [tab, setTab] = useState('brrrr');
  const [dark, setDark] = useState(true);

  // ── BRRRR state ──────────────────────────────────────────────────────────
  const [address, setAddress]               = useState('');
  const [purchasePrice, setPurchasePrice]   = useState('');
  const [rehabBudget, setRehabBudget]       = useState('');
  const [arv, setArv]                       = useState('');
  const [monthlyRent, setMonthlyRent]       = useState('');
  const [otherIncome, setOtherIncome]       = useState('');
  const [privateLoanAmt, setPrivateLoanAmt] = useState('');
  const [loanPoints, setLoanPoints]         = useState('0');
  const [holdingMonths, setHoldingMonths]   = useState('4');
  const [privateRate, setPrivateRate]       = useState('18');
  const [monthlyPayments, setMonthlyPayments] = useState(false);
  const [refiRate, setRefiRate]             = useState('7.375');
  const [targetCashOut, setTargetCashOut]   = useState('20000');
  const [vacancyPct, setVacancyPct]         = useState('5');
  const [capexPct, setCapexPct]             = useState('5');
  const [pmPct, setPmPct]                   = useState('0');
  const [maintenancePct, setMaintenancePct] = useState('5');
  const [results, setResults]               = useState(null);

  // ── Flip state ───────────────────────────────────────────────────────────
  const [fAddress, setFAddress]           = useState('');
  const [fPurchase, setFPurchase]         = useState('');
  const [fRehab, setFRehab]               = useState('');
  const [fArv, setFArv]                   = useState('');
  const [fPrivateLoan, setFPrivateLoan]   = useState('');
  const [fPoints, setFPoints]             = useState('0');
  const [fMonths, setFMonths]             = useState('6');
  const [fRate, setFRate]                 = useState('18');
  const [fSellingCosts, setFSellingCosts] = useState('8');
  const [fTargetProfit, setFTargetProfit] = useState('20000');
  const [fResults, setFResults]           = useState(null);

  // ── Wholesale state ──────────────────────────────────────────────────────
  const [wArv, setWArv]                   = useState('');
  const [wBuyerRehab, setWBuyerRehab]     = useState('');
  const [wContractPrice, setWContractPrice] = useState('');
  const [wTargetCO, setWTargetCO]         = useState('20000');
  const [wBuyerPoints, setWBuyerPoints]   = useState('0');
  const [wBuyerRate, setWBuyerRate]       = useState('18');
  const [wBuyerMonths, setWBuyerMonths]   = useState('4');
  const [wFlipProfit, setWFlipProfit]     = useState('20000');
  const [wFlipSelling, setWFlipSelling]   = useState('8');
  const [wResults, setWResults]           = useState(null);

  // ── Creative state ───────────────────────────────────────────────────────
  const [cAddress, setCAddress]           = useState('');
  const [cSellerBalance, setCSellerBalance] = useState('');
  const [cSellerPI, setCSellerPI]         = useState('');
  const [cDownToSeller, setCDownToSeller] = useState('');
  const [cWrapLoan, setCWrapLoan]         = useState('');
  const [cWrapRate, setCWrapRate]         = useState('');
  const [cBuyerDown, setCBuyerDown]       = useState('');
  const [cHoldYrs, setCHoldYrs]           = useState('5');
  const [cResults, setCResults]           = useState(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYZE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const analyzeBRRRR = () => {
    const purchase = parseFloat(purchasePrice) || 0;
    const rehab    = parseFloat(rehabBudget)   || 0;
    const arvVal   = parseFloat(arv)           || 0;
    const rent     = parseFloat(monthlyRent)   || 0;
    const other    = parseFloat(otherIncome)   || 0;
    const months   = Math.max(parseFloat(holdingMonths) || 4, 3);
    const privRate = parseFloat(privateRate)   / 100;
    const points   = parseFloat(loanPoints)   / 100 || 0;
    const rate     = parseFloat(refiRate)      || 0;
    const target   = parseFloat(targetCashOut) || 0;

    const privateLoan  = parseFloat(privateLoanAmt) || (purchase + rehab);
    const pointsCost   = privateLoan * points;
    const holdingCost  = privateLoan * (privRate / 12) * months;
    const totalAllIn   = purchase + rehab + PURCHASE_CLOSING + pointsCost + holdingCost;

    const taxes     = arvVal * 0.010 / 12;
    const insurance = arvVal * 0.0062 / 12;

    const refiLoan75    = arvVal * 0.75;
    const refiClosing75 = refiLoan75 * 0.0325 + 4039;
    const cashLeftIn75  = totalAllIn - refiLoan75 + refiClosing75;
    const pi75          = calcPI(refiLoan75, rate);
    const piti75        = pi75 + taxes + insurance;

    const refiLoan80    = arvVal * 0.80;
    const refiClosing80 = refiLoan80 * 0.0325 + 4039;
    const cashLeftIn80  = totalAllIn - refiLoan80 + refiClosing80;
    const pi80          = calcPI(refiLoan80, rate);
    const piti80        = pi80 + taxes + insurance;

    const vacancy    = parseFloat(vacancyPct)     / 100;
    const capex      = parseFloat(capexPct)       / 100;
    const pm         = parseFloat(pmPct)          / 100;
    const maint      = parseFloat(maintenancePct) / 100;
    const expenseAmt = rent * (vacancy + capex + pm + maint);
    const grossIncome = rent + other;

    const netCF75 = grossIncome - piti75 - expenseAmt;
    const netCF80 = grossIncome - piti80 - expenseAmt;
    const coC75   = cashLeftIn75 > 0 ? netCF75 * 12 / cashLeftIn75 : null;
    const coC80   = cashLeftIn80 > 0 ? netCF80 * 12 / cashLeftIn80 : null;

    const holdFactor  = 1 + points + (privRate / 12) * months;
    const calcMAO     = (loan, closing, tc) => (loan - closing - PURCHASE_CLOSING - tc) / holdFactor - rehab;
    const mao75target = calcMAO(refiLoan75, refiClosing75, target);
    const mao75zero   = calcMAO(refiLoan75, refiClosing75, 0);
    const mao80zero   = calcMAO(refiLoan80, refiClosing80, 0);
    const vsMAO       = purchase > 0 && mao75target > 0 ? purchase - mao75target : null;

    setResults({
      purchase, rehab, pointsCost, holdingCost, totalAllIn,
      refiLoan75, refiClosing75, cashLeftIn75, pi75, piti75, netCF75, coC75,
      refiLoan80, refiClosing80, cashLeftIn80, pi80, piti80, netCF80, coC80,
      taxes, insurance, grossIncome, rent, other, expenseAmt,
      vacancyAmt: rent * vacancy, capexAmt: rent * capex, pmAmt: rent * pm, maintAmt: rent * maint,
      mao75target, mao75zero, mao80zero, vsMAO,
      arvVal, target, months, rateStr: privateRate, ptsStr: loanPoints,
    });
  };

  const analyzeFlip = () => {
    const purchase   = parseFloat(fPurchase) || 0;
    const rehab      = parseFloat(fRehab)    || 0;
    const arvVal     = parseFloat(fArv)      || 0;
    const months     = Math.max(parseFloat(fMonths) || 6, 1);
    const privRate   = parseFloat(fRate) / 100;
    const points     = parseFloat(fPoints) / 100 || 0;
    const sellingPct = parseFloat(fSellingCosts) / 100 || 0.08;
    const targetProfit = parseFloat(fTargetProfit) || 0;

    const privateLoan = parseFloat(fPrivateLoan) || (purchase + rehab);
    const pointsCost  = privateLoan * points;
    const holdingCost = privateLoan * (privRate / 12) * months;
    const totalAllIn  = purchase + rehab + PURCHASE_CLOSING + pointsCost + holdingCost;

    const sellingCosts  = arvVal * sellingPct;
    const netProfit     = arvVal - totalAllIn - sellingCosts;
    const roi           = totalAllIn > 0 ? netProfit / totalAllIn : 0;
    const annualizedRoi = months > 0 ? roi / (months / 12) : 0;

    const holdFactor    = 1 + points + (privRate / 12) * months;
    const netProceeds   = arvVal * (1 - sellingPct);
    // MAO at target profit: netProceeds - PURCHASE_CLOSING - targetProfit = allIn = (p+r)*holdFactor → p = (netProceeds - PURCHASE_CLOSING - targetProfit)/holdFactor - rehab
    const maoTarget     = (netProceeds - PURCHASE_CLOSING - targetProfit) / holdFactor - rehab;
    const maoBreakEven  = (netProceeds - PURCHASE_CLOSING) / holdFactor - rehab;
    const mao70pct      = arvVal * 0.70 - rehab; // classic 70% rule
    const vsMAO         = purchase > 0 && maoTarget > 0 ? purchase - maoTarget : null;

    setFResults({
      purchase, rehab, arvVal, pointsCost, holdingCost, totalAllIn,
      sellingCosts, netProfit, roi, annualizedRoi,
      maoTarget, maoBreakEven, mao70pct, vsMAO,
      months, sellingPct, targetProfit,
    });
  };

  const analyzeWholesale = () => {
    const arvVal        = parseFloat(wArv) || 0;
    const buyerRehab    = parseFloat(wBuyerRehab) || 0;
    const contractPrice = parseFloat(wContractPrice) || 0;
    const targetCO      = parseFloat(wTargetCO) || 0;
    const buyerPoints   = parseFloat(wBuyerPoints) / 100 || 0;
    const buyerRate     = parseFloat(wBuyerRate) / 100;
    const buyerMonths   = Math.max(parseFloat(wBuyerMonths) || 4, 1);
    const flipTarget    = parseFloat(wFlipProfit) || 0;
    const flipSelling   = parseFloat(wFlipSelling) / 100 || 0.08;

    const refiLoan75     = arvVal * 0.75;
    const refiClosing75  = refiLoan75 * 0.0325 + 4039;
    const brrrHoldFactor = 1 + buyerPoints + (buyerRate / 12) * buyerMonths;
    const brrrMAO        = (refiLoan75 - refiClosing75 - PURCHASE_CLOSING - targetCO) / brrrHoldFactor - buyerRehab;
    const brrrMAOzero    = (refiLoan75 - refiClosing75 - PURCHASE_CLOSING) / brrrHoldFactor - buyerRehab;

    const netProceeds    = arvVal * (1 - flipSelling);
    const flipMAO        = netProceeds - buyerRehab - flipTarget - PURCHASE_CLOSING;
    const flipMAOzero    = netProceeds - buyerRehab - PURCHASE_CLOSING;
    const flip70         = arvVal * 0.70 - buyerRehab;

    const bestMAO = Math.min(
      brrrMAO > 0 ? brrrMAO : Infinity,
      flipMAO > 0 ? flipMAO : Infinity
    );

    const brrrAssignment = contractPrice > 0 && brrrMAO > 0 ? brrrMAO - contractPrice : null;
    const flipAssignment = contractPrice > 0 && flipMAO > 0 ? flipMAO - contractPrice : null;

    setWResults({
      arvVal, buyerRehab, contractPrice, refiLoan75, refiClosing75,
      brrrMAO, brrrMAOzero, flipMAO, flipMAOzero, flip70,
      bestMAO, brrrAssignment, flipAssignment,
      targetCO, flipTarget,
    });
  };

  const analyzeCreative = () => {
    const sellerBalance = parseFloat(cSellerBalance) || 0;
    const sellerPI      = parseFloat(cSellerPI)      || 0;
    const downToSeller  = parseFloat(cDownToSeller)  || 0;
    const wrapLoan      = parseFloat(cWrapLoan)      || sellerBalance;
    const wrapRate      = parseFloat(cWrapRate)      || 0;
    const buyerDown     = parseFloat(cBuyerDown)     || 0;
    const holdYrs       = parseFloat(cHoldYrs)       || 5;

    const buyerPI        = calcPI(wrapLoan, wrapRate, 30);
    const monthlySpread  = buyerPI - sellerPI;
    const upfrontProfit  = buyerDown - downToSeller;
    const annualSpread   = monthlySpread * 12;
    const projectedProfit = upfrontProfit + monthlySpread * 12 * holdYrs;
    const wrapMarkup     = wrapLoan - sellerBalance;

    setCResults({ sellerBalance, sellerPI, downToSeller, wrapLoan, wrapRate, buyerDown, buyerPI, monthlySpread, upfrontProfit, annualSpread, projectedProfit, wrapMarkup, holdYrs });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME
  // ═══════════════════════════════════════════════════════════════════════════
  const T = dark ? {
    page:      '#0d0d0d',
    card:      '#1a1a1a',
    cardBorder:'#2a2a2a',
    cardSub:   '#111',
    text:      '#e5e7eb',
    textMuted: '#9ca3af',
    textFaint: '#6b7280',
    inp:       '#222',
    inpBorder: '#333',
    inpText:   '#e5e7eb',
    div:       '#2a2a2a',
    divLight:  '#222',
    secColor:  '#6b7280',
    rowBorder: '#222',
    warnBg:    '#292106',
    warnBorder:'#5c4a05',
    warnTitle: '#fbbf24',
    warnText:  '#d97706',
