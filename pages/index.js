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

const rating = (cf, cashOut) => {
  if (cashOut && cf >= 100) return 'Grand Slam';
  if (cf >= 300) return 'Grand Slam';
  if (cf >= 150) return 'Banger';
  if (cf >= 50)  return 'Strong';
  if (cf >= 0)   return 'Marginal';
  return 'Negative';
};
const ratingColor = r => ({ 'Grand Slam': '#7c3aed', 'Banger': '#16a34a', 'Strong': '#2563eb', 'Marginal': '#d97706', 'Negative': '#dc2626' }[r] || '#6b7280');

export default function Home() {
  const [address, setAddress]             = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [rehabBudget, setRehabBudget]     = useState('');
  const [arv, setArv]                     = useState('');
  const [monthlyRent, setMonthlyRent]     = useState('');
  const [otherIncome, setOtherIncome]     = useState('');
  const [privateLoanAmt, setPrivateLoanAmt] = useState('');
  const [loanPoints, setLoanPoints]         = useState('0');
  const [holdingMonths, setHoldingMonths]   = useState('4');
  const [privateRate, setPrivateRate]       = useState('18');
  const [monthlyPayments, setMonthlyPayments] = useState(false);
  const [refiRate, setRefiRate]           = useState('7.375');
  const [targetCashOut, setTargetCashOut] = useState('20000');
  const [vacancyPct, setVacancyPct]         = useState('5');
  const [capexPct, setCapexPct]             = useState('5');
  const [pmPct, setPmPct]                   = useState('0');
  const [maintenancePct, setMaintenancePct] = useState('5');
  const [results, setResults] = useState(null);

  const analyze = () => {
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
    const privateLoan = parseFloat(privateLoanAmt) || (purchase + rehab);
    const pointsCost  = privateLoan * points;
    const holdingCost = privateLoan * (privRate / 12) * months;
    const totalAllIn  = purchase + rehab + PURCHASE_CLOSING + pointsCost + holdingCost;
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
    const vacancy     = parseFloat(vacancyPct)     / 100;
    const capex       = parseFloat(capexPct)       / 100;
    const pm          = parseFloat(pmPct)          / 100;
    const maint       = parseFloat(maintenancePct) / 100;
    const expenseAmt  = rent * (vacancy + capex + pm + maint);
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
    const vsMAO = purchase > 0 && mao75target > 0 ? purchase - mao75target : null;
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

  const inp  = { width: '100%', padding: '9px 12px', fontSize: 14, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111', outline: 'none', boxSizing: 'border-box' };
  const lbl  = { display: 'block', marginBottom: 5, fontWeight: 600, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 };
  const fw   = { marginBottom: 12 };
  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 12 };
  const sec  = { fontWeight: 700, fontSize: 11, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 };

  const LineItem = ({ label, amount, positive, bold, gray }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 14 : 12, fontWeight: bold ? 800 : 400, padding: '3px 0' }}>
      <span style={{ color: gray ? '#9ca3af' : '#374151' }}>{label}</span>
      <span style={{ color: gray ? '#9ca3af' : positive ? '#16a34a' : '#ef4444', fontWeight: bold ? 800 : 600 }}>
        {positive ? '+' : '-'}{fmt(Math.abs(amount))}
      </span>
    </div>
  );

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: '#0a0a0a', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ background: '#22c55e', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#000' }}>DV</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px' }}>DealVelocity</div>
          <div style={{ color: '#4b5563', fontSize: 11 }}>BRRRR Analyzer · Home Buyers ICT</div>
        </div>
      </div>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: results ? '360px 1fr' : '500px', gap: 24, justifyContent: 'center' }}>
          <div>
            <div style={card}>
              <div style={sec}>Property</div>
              <div style={fw}>
                <label style={lbl}>Address</label>
                <input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, Wichita KS" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Purchase Price (or Asking)', purchasePrice, setPurchasePrice, '125,000'],
                  ['Rehab Budget',               rehabBudget,   setRehabBudget,   '15,000'],
                  ['After-Repair Value (ARV)',    arv,           setArv,           '240,000'],
                  ['Base Monthly Rent',           monthlyRent,   setMonthlyRent,   '1,850'],
                ].map(([l, v, s, ph]) => (
                  <div key={l} style={fw}>
                    <label style={lbl}>{l}</label>
                    <input style={inp} type="number" value={v} onChange={e => s(e.target.value)} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div style={fw}>
                <label style={lbl}>Pet Fees / Other Monthly Income</label>
                <input style={inp} type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} placeholder="50  (pet fees, parking — flows 100% to cash flow)" />
              </div>
            </div>
            <div style={card}>
              <div style={sec}>Private Money</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={fw}><label style={lbl}>Loan Amount</label><input style={inp} type="number" value={privateLoanAmt} onChange={e => setPrivateLoanAmt(e.target.value)} placeholder="Auto (purchase + rehab)" /></div>
                <div style={fw}><label style={lbl}>Loan Points %</label><input style={inp} type="number" value={loanPoints} onChange={e => setLoanPoints(e.target.value)} /></div>
                <div style={fw}><label style={lbl}>Interest Rate %/yr</label><input style={inp} type="number" value={privateRate} onChange={e => setPrivateRate(e.target.value)} /></div>
                <div style={fw}><label style={lbl}>Hold Months</label><input style={inp} type="number" value={holdingMonths} onChange={e => setHoldingMonths(e.target.value)} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={monthlyPayments} onChange={e => setMonthlyPayments(e.target.checked)} />
                Monthly interest payments required (vs. accrued balloon)
              </label>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Auto-loan = purchase + rehab. Points added to all-in upfront. Interest accrues to balloon at refi/sale.</div>
            </div>
            <div style={card}>
              <div style={sec}>Refi — NON-QM 30yr Fixed</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={fw}><label style={lbl}>Refi Rate %</label><input style={inp} type="number" value={refiRate} onChange={e => setRefiRate(e.target.value)} /></div>
                <div style={fw}><label style={lbl}>Target Cash Out $</label><input style={inp} type="number" value={targetCashOut} onChange={e => setTargetCashOut(e.target.value)} placeholder="20000" /></div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Closing: 3.25% of loan + $4,039 fixed (IFW16190659) · Results show 75% cash-out AND 80% rate & term side by side</div>
            </div>
            <div style={card}>
              <div style={sec}>Monthly Expense Rates (% of Base Rent)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Vacancy %', vacancyPct, setVacancyPct], ['CapEx %', capexPct, setCapexPct], ['Prop Mgmt %', pmPct, setPmPct], ['Maintenance %', maintenancePct, setMaintenancePct]].map(([l, v, s]) => (
                  <div key={l} style={fw}><label style={lbl}>{l}</label><input style={inp} type="number" value={v} onChange={e => s(e.target.value)} /></div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Defaults: 5% vacancy, 5% capex, 0% PM (self-managed), 5% maintenance = 15% total</div>
            </div>
            <button onClick={analyze} style={{ width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 700, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Analyze Deal</button>
          </div>

          {results && (
            <div>
              <div style={{ background: '#0a0a0a', borderRadius: 12, padding: '18px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Max Allowable Offer</div>
                    <div style={{ color: '#4b5563', fontSize: 11, marginTop: 3 }}>ARV {fmt(results.arvVal)} · {results.months}mo @ {results.rateStr}%{results.rehab > 0 ? ' · rehab ' + fmt(results.rehab) : ''}{parseFloat(results.ptsStr) > 0 ? ' · ' + results.ptsStr + ' pts' : ''}</div>
                  </div>
                  {results.vsMAO !== null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Asking vs MAO (75%)</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: results.vsMAO > 0 ? '#ef4444' : '#22c55e' }}>
                        {results.vsMAO > 0 ? '^ ' + fmt(results.vsMAO) + ' OVER' : 'v ' + fmt(Math.abs(results.vsMAO)) + ' room'}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                  {[
                    { label: '75% — Cash Out ' + fmt(results.target), value: results.mao75target, sub: 'walk away ' + fmt(results.target) + ' at closing', hi: true },
                    { label: '75% — Break Even',  value: results.mao75zero,   sub: 'all money recycled, $0 in or out', hi: false },
                    { label: '80% — Rate & Term', value: results.mao80zero,   sub: '$0 left in, no cash to borrower',  hi: false },
                  ].map(({ label, value, sub, hi }, i) => (
                    <div key={label} style={{ paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
                      <div style={{ color: '#4b5563', fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: value > 0 ? (hi ? '#22c55e' : '#e5e7eb') : '#ef4444' }}>{value > 0 ? fmt(value) : 'ARV too low'}</div>
                      <div style={{ color: '#374151', fontSize: 11, marginTop: 3 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 14, paddingTop: 10, fontSize: 11, color: '#374151' }}>
                  Adjust rehab, hold months, or rate to see MAO change. Enter asking price in Purchase Price to compare against MAO.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { title: '75% Cash Out Refi', tag: 'Cash Out Product', loan: results.refiLoan75, closing: results.refiClosing75, leftIn: results.cashLeftIn75, pi: results.pi75, piti: results.piti75, cf: results.netCF75, coC: results.coC75, note: '*Cash to borrower ~$700-1,000 less actual (prepaids/escrow). IFW16190659 Prescott: $20,330 actual vs $21,056 model.', isCashOut: true },
                  { title: '80% Rate & Term', tag: 'No Cash Out', loan: results.refiLoan80, closing: results.refiClosing80, leftIn: results.cashLeftIn80, pi: results.pi80, piti: results.piti80, cf: results.netCF80, coC: results.coC80, note: 'Rate & term: no check to borrower even if loan exceeds all-in. Use when cash-out not available or seasoning not met.', isCashOut: false },
                ].map(({ title, tag, loan, closing, leftIn, pi, piti, cf, coC, note, isCashOut }) => {
                  const r = rating(cf, leftIn <= 0);
                  const rc = ratingColor(r);
                  const cashDisplay = leftIn < 0 ? fmt(Math.abs(leftIn)) + ' OUT*' : leftIn === 0 ? 'Break Even' : fmt(leftIn) + ' IN';
                  const cashColor   = leftIn <= 0 ? '#16a34a' : '#dc2626';
                  return (
                    <div key={title} style={{ background: '#fff', border: '2px solid ' + rc, borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div><div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{title}</div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tag}</div></div>
                        <div style={{ background: rc, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{r}</div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: cf >= 0 ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
                          {cf >= 0 ? '+' : ''}{fmt(cf)}<span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>/mo</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>net cash flow</div>
                      </div>
                      {[
                        ['Refi Loan', fmt(loan), '#111'],
                        ['Refi Closing', fmt(closing), '#111'],
                        [isCashOut ? 'Cash to Borrower' : 'Cash Left In', cashDisplay, cashColor],
                        ['P&I /mo', fmt(pi), '#111'],
                        ['PITI /mo', fmt(piti), '#111'],
                        ['Annual CF', fmt(cf * 12), cf >= 0 ? '#16a34a' : '#dc2626'],
                        ['CoC Return', coC !== null ? pct(coC) : (isCashOut ? 'infinity cash out' : 'rate & term'), '#2563eb'],
                      ].map(([l, v, c]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderTop: '1px solid #f3f4f6' }}>
                          <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 600, color: c }}>{v}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>{note}</div>
                    </div>
                  );
                })}
              </div>

              <div style={card}>
                <div style={sec}>Monthly Cash Flow Detail - 75% Cash Out</div>
                <LineItem label="Base Rent" amount={results.rent} positive={true} />
                {results.other > 0 && <LineItem label="Pet Fees / Other Income" amount={results.other} positive={true} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, padding: '3px 0 6px' }}>
                  <span style={{ color: '#374151' }}>Gross Income</span><span style={{ color: '#16a34a' }}>+{fmt(results.grossIncome)}</span>
                </div>
                <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0 6px' }} />
                <LineItem label={'Mortgage P&I (' + refiRate + '%)'} amount={results.pi75} positive={false} />
                <LineItem label="Property Taxes (1.0% ARV/yr)" amount={results.taxes} positive={false} />
                <LineItem label="Insurance (0.62% ARV/yr)" amount={results.insurance} positive={false} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', padding: '2px 0 4px', fontStyle: 'italic' }}>
                  <span>PITI = {fmt(results.piti75)} (matches IFW16190659)</span><span>-{fmt(results.piti75)}</span>
                </div>
                <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0 6px' }} />
                {results.vacancyAmt > 0 && <LineItem label={'Vacancy (' + vacancyPct + '%)'} amount={results.vacancyAmt} positive={false} />}
                {results.capexAmt > 0   && <LineItem label={'CapEx (' + capexPct + '%)'} amount={results.capexAmt} positive={false} />}
                {results.pmAmt > 0      && <LineItem label={'Prop Mgmt (' + pmPct + '%)'} amount={results.pmAmt} positive={false} />}
                {results.maintAmt > 0   && <LineItem label={'Maintenance (' + maintenancePct + '%)'} amount={results.maintAmt} positive={false} />}
                {results.expenseAmt === 0 && <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 0', fontStyle: 'italic' }}>No reserves set (fresh rehab / signed lease)</div>}
                <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
                <LineItem label="Net Cash Flow" amount={results.netCF75} positive={results.netCF75 >= 0} bold={true} />
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e5e7eb', fontSize: 11, color: '#6b7280' }}>
                  At 80%: PITI = {fmt(results.piti80)}/mo (+{fmt(results.piti80 - results.piti75)}/mo) → Net CF {results.netCF80 >= 0 ? '+' : ''}{fmt(results.netCF80)}/mo
                </div>
              </div>

              <div style={{ ...card, background: '#f9fafb' }}>
                <div style={{ ...sec, color: '#9ca3af' }}>All-In Cost Breakdown</div>
                {[
                  ['Purchase Price', results.purchase],
                  ['Rehab Budget', results.rehab],
                  ['Purchase Closing Costs (HBI actuals)', PURCHASE_CLOSING],
                  ['Private Money Interest (' + results.months + 'mo @ ' + results.rateStr + '%)', results.holdingCost],
                  ...(results.pointsCost > 0 ? [['Loan Points (' + results.ptsStr + '%)', results.pointsCost]] : []),
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 5 }}>
                    <span>{l}</span><span style={{ fontWeight: 600 }}>{fmt(v)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13, color: '#111', borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 8 }}>
                  <span>Total All-In</span><span>{fmt(results.totalAllIn)}</span>
                </div>
              </div>

              <div style={{ ...card, background: '#f9fafb' }}>
                <div style={{ ...sec, color: '#9ca3af' }}>Purchase Closing Costs (HBI Actuals)</div>
                {[['Recording Fees', 400], ['Title - Closing', 340], ['Title - Lender Policy', 266], ['Title - Owner Policy', 858]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
                    <span>{l}</span><span>{fmt(v)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12, color: '#6b7280', borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 6 }}>
                  <span>Total</span><span>$1,864</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
         }
