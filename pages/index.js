import { useState } from 'react';

const fmt = (n) => '$' + Math.round(n).toLocaleString();
const pct = (n) => (n * 100).toFixed(1) + '%';

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

  const [refiLtv, setRefiLtv]   = useState('75');
  const [refiRate, setRefiRate] = useState('7.375');

  const [vacancyPct, setVacancyPct]         = useState('8');
  const [capexPct, setCapexPct]             = useState('5');
  const [pmPct, setPmPct]                   = useState('8');
  const [maintenancePct, setMaintenancePct] = useState('5');

  const [results, setResults] = useState(null);

  const calculate = () => {
    const purchase  = parseFloat(purchasePrice) || 0;
    const rehab     = parseFloat(rehabBudget)   || 0;
    const arvVal    = parseFloat(arv)           || 0;
    const rent      = parseFloat(monthlyRent)   || 0;
    const other     = parseFloat(otherIncome)   || 0;
    const months    = Math.max(parseFloat(holdingMonths) || 4, 3);
    const privRate  = parseFloat(privateRate) / 100;
    const points    = parseFloat(loanPoints)  / 100;
    const ltvDec    = parseFloat(refiLtv)     / 100;
    const rateDec   = parseFloat(refiRate)    / 100;

    const purchaseClosingCosts = 1864;

    const privateLoan = parseFloat(privateLoanAmt) || (purchase + rehab);
    const pointsCost  = privateLoan * points;
    const holdingCost = privateLoan * (privRate / 12) * months;

    const totalAllIn = purchase + rehab + purchaseClosingCosts + pointsCost + holdingCost;

    const refiLoanAmount   = arvVal * ltvDec;
    const refiClosingCosts = (refiLoanAmount * 0.0325) + 4940;
    const cashLeftIn       = totalAllIn - refiLoanAmount + refiClosingCosts;

    const monthlyRate = rateDec / 12;
    const monthlyPI   = refiLoanAmount > 0
      ? (refiLoanAmount * monthlyRate * Math.pow(1 + monthlyRate, 360)) / (Math.pow(1 + monthlyRate, 360) - 1)
      : 0;

    const monthlyTaxes = (arvVal * 0.010)  / 12;
    const monthlyIns   = (arvVal * 0.0062) / 12;
    const monthlyPITI  = monthlyPI + monthlyTaxes + monthlyIns;

    const vacancyAmt = rent * (parseFloat(vacancyPct)     / 100);
    const capexAmt   = rent * (parseFloat(capexPct)       / 100);
    const pmAmt      = rent * (parseFloat(pmPct)          / 100);
    const maintAmt   = rent * (parseFloat(maintenancePct) / 100);
    const totalExp   = monthlyPITI + vacancyAmt + capexAmt + pmAmt + maintAmt;

    const grossIncome = rent + other;
    const netCashFlow = grossIncome - totalExp;
    const annualCF    = netCashFlow * 12;
    const cocReturn   = cashLeftIn > 0 ? annualCF / cashLeftIn : null;
    const grossYield  = arvVal > 0 ? (grossIncome * 12) / arvVal : 0;
    const equityCap   = arvVal - totalAllIn;
    const spreadPct   = arvVal > 0 ? equityCap / arvVal : 0;

    let rating = 'Pass'; let ratingColor = '#6b7280';
    if      (cashLeftIn <= 0 && netCashFlow >= 150)                 { rating = 'Grand Slam'; ratingColor = '#7c3aed'; }
    else if (netCashFlow >= 200 && cashLeftIn <= totalAllIn * 0.15) { rating = 'Banger';     ratingColor = '#16a34a'; }
    else if (netCashFlow >= 150)                                    { rating = 'Strong';     ratingColor = '#2563eb'; }
    else if (netCashFlow >= 50)                                     { rating = 'Marginal';   ratingColor = '#d97706'; }

    setResults({
      purchase, rehab, purchaseClosingCosts, pointsCost, holdingCost, privateLoan,
      totalAllIn, refiLoanAmount, refiClosingCosts, cashLeftIn,
      monthlyPI, monthlyTaxes, monthlyIns, monthlyPITI,
      vacancyAmt, capexAmt, pmAmt, maintAmt, totalExp,
      rent, other, grossIncome, netCashFlow, annualCF,
      cocReturn, grossYield, equityCap, spreadPct, rating, ratingColor,
    });
  };

  const inp = { width: '100%', padding: '9px 12px', fontSize: 14, border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111', outline: 'none', boxSizing: 'border-box' };
  const lbl = { display: 'block', marginBottom: 5, fontWeight: 600, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 };
  const fw  = { marginBottom: 12 };
  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 12 };
  const sec  = { fontWeight: 700, fontSize: 11, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 };
  const mLbl = { fontSize: 11, color: '#6b7280', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 };
  const mVal = { fontSize: 17, fontWeight: 700, color: '#111' };

  const Row = ({ label, amount, positive, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: bold ? 14 : 13, fontWeight: bold ? 800 : 400, padding: '3px 0' }}>
      <span style={{ color: '#374151' }}>{label}</span>
      <span style={{ color: positive ? '#16a34a' : '#ef4444', fontWeight: bold ? 800 : 600 }}>
        {positive ? '+' : '-'}{fmt(Math.abs(amount))}
      </span>
    </div>
  );

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: '#0a0a0a', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ background: '#22c55e', width: 30, height: 30, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#000' }}>DV</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px', lineHeight: 1.2 }}>DealVelocity</div>
          <div style={{ color: '#4b5563', fontSize: 11 }}>BRRRR Analyzer - Home Buyers ICT</div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: results ? '400px 1fr' : '500px', gap: 24, justifyContent: 'center' }}>

          <div>
            <div style={card}>
              <div style={sec}>Property</div>
              <div style={fw}>
                <label style={lbl}>Address</label>
                <input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="1914 S Prescott Circle, Wichita KS" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Purchase Price',           purchasePrice, setPurchasePrice, '125,000'],
                  ['Rehab Budget',             rehabBudget,   setRehabBudget,   '15,000'],
                  ['After-Repair Value (ARV)', arv,           setArv,           '240,000'],
                  ['Base Monthly Rent',        monthlyRent,   setMonthlyRent,   '1,850'],
                ].map(([l, v, s, ph]) => (
                  <div key={l} style={fw}>
                    <label style={lbl}>{l}</label>
                    <input style={inp} type="number" value={v} onChange={e => s(e.target.value)} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div style={fw}>
                <label style={lbl}>Pet Fees / Other Monthly Income</label>
                <input style={inp} type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} placeholder="50  (pet fees, parking, storage)" />
              </div>
            </div>

            <div style={card}>
              <div style={sec}>Private Money</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={fw}>
                  <label style={lbl}>Loan Amount</label>
                  <input style={inp} type="number" value={privateLoanAmt} onChange={e => setPrivateLoanAmt(e.target.value)} placeholder="Auto (purchase + rehab)" />
                </div>
                <div style={fw}>
                  <label style={lbl}>Loan Points %</label>
                  <input style={inp} type="number" value={loanPoints} onChange={e => setLoanPoints(e.target.value)} placeholder="0" />
                </div>
                <div style={fw}>
                  <label style={lbl}>Interest Rate %/yr</label>
                  <input style={inp} type="number" value={privateRate} onChange={e => setPrivateRate(e.target.value)} />
                </div>
                <div style={fw}>
                  <label style={lbl}>Hold Months</label>
                  <input style={inp} type="number" value={holdingMonths} onChange={e => setHoldingMonths(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <input type="checkbox" id="mthly" checked={monthlyPayments} onChange={e => setMonthlyPayments(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                <label htmlFor="mthly" style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>Monthly interest payments required (vs. accrued balloon)</label>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Auto-loan = purchase + rehab. Points added to all-in cost. {monthlyPayments ? 'Monthly interest payments during hold period.' : 'Interest accrues and pays off at refi/sale.'}
              </div>
            </div>

            <div style={card}>
              <div style={sec}>Refi - Planted Local Lending (NON-QM 30yr)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={fw}>
                  <label style={lbl}>LTV %</label>
                  <input style={inp} type="number" value={refiLtv} onChange={e => setRefiLtv(e.target.value)} />
                </div>
                <div style={fw}>
                  <label style={lbl}>Rate %</label>
                  <input style={inp} type="number" value={refiRate} onChange={e => setRefiRate(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -4 }}>Closing costs: 3.25% of loan + $4,940 fixed (Trish Reedy actuals)</div>
            </div>

            <div style={card}>
              <div style={sec}>Monthly Expense Rates (% of Base Rent)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Vacancy %',     vacancyPct,     setVacancyPct],
                  ['CapEx %',       capexPct,       setCapexPct],
                  ['Prop Mgmt %',   pmPct,          setPmPct],
                  ['Maintenance %', maintenancePct, setMaintenancePct],
                ].map(([l, v, s]) => (
                  <div key={l} style={fw}>
                    <label style={lbl}>{l}</label>
                    <input style={inp} type="number" value={v} onChange={e => s(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={calculate} style={{ width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 700, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
              Analyze Deal
            </button>
          </div>

          {results && (
            <div>
              <div style={{ background: results.ratingColor, borderRadius: 12, padding: '16px 22px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Deal Rating</div>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginTop: 2 }}>{results.rating}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>Net Cash Flow</div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 800, marginTop: 2, letterSpacing: -1 }}>
                    {results.netCashFlow >= 0 ? '+' : ''}{fmt(results.netCashFlow)}
                    <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.75 }}>/mo</span>
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={sec}>BRRRR Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  {[
                    ['Total All-In',   fmt(results.totalAllIn), null],
                    ['ARV',            fmt(parseFloat(arv)||0), null],
                    ['Equity Capture', fmt(results.equityCap) + ' (' + pct(results.spreadPct) + ')', results.equityCap >= 0 ? '#16a34a' : '#ef4444'],
                    ['Refi Loan',      fmt(results.refiLoanAmount), null],
                    ['Refi Closing',   fmt(results.refiClosingCosts), null],
                    ['Cash Left In',   results.cashLeftIn < 0 ? fmt(Math.abs(results.cashLeftIn)) + ' OUT' : fmt(results.cashLeftIn), results.cashLeftIn < 0 ? '#16a34a' : '#111'],
                  ].map(([l, v, c]) => (
                    <div key={l}>
                      <div style={mLbl}>{l}</div>
                      <div style={{ ...mVal, fontSize: 15, color: c || '#111' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={sec}>Returns</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={mLbl}>Cash-on-Cash</div>
                    <div style={{ ...mVal, color: '#2563eb' }}>{results.cocReturn !== null ? pct(results.cocReturn) : 'cash out'}</div>
                  </div>
                  <div>
                    <div style={mLbl}>Gross Yield</div>
                    <div style={mVal}>{pct(results.grossYield)}</div>
                  </div>
                  <div>
                    <div style={mLbl}>Annual Cash Flow</div>
                    <div style={{ ...mVal, color: results.annualCF >= 0 ? '#16a34a' : '#ef4444' }}>{fmt(results.annualCF)}</div>
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={sec}>Monthly Cash Flow</div>
                <Row label="Base Rent" amount={results.rent} positive={true} />
                {results.other > 0 && <Row label="Pet Fees / Other Income" amount={results.other} positive={true} />}
                {results.other > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#374151', padding: '2px 0 4px' }}>
                    <span>Gross Income</span><span style={{ color: '#16a34a' }}>+{fmt(results.grossIncome)}</span>
                  </div>
                )}
                <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0 6px' }} />
                <Row label={'Mortgage P&I (' + refiRate + '%)'} amount={results.monthlyPI} positive={false} />
                <Row label="Property Taxes (1.0% ARV/yr)" amount={results.monthlyTaxes} positive={false} />
                <Row label="Insurance (0.62% ARV/yr)" amount={results.monthlyIns} positive={false} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', padding: '1px 0 4px', fontStyle: 'italic' }}>
                  <span>PITI subtotal</span><span>-{fmt(results.monthlyPITI)}</span>
                </div>
                <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0 6px' }} />
                <Row label={'Vacancy (' + vacancyPct + '%)'} amount={results.vacancyAmt} positive={false} />
                <Row label={'CapEx Reserve (' + capexPct + '%)'} amount={results.capexAmt} positive={false} />
                <Row label={'Property Mgmt (' + pmPct + '%)'} amount={results.pmAmt} positive={false} />
                <Row label={'Maintenance (' + maintenancePct + '%)'} amount={results.maintAmt} positive={false} />
                <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
                <Row label="Net Cash Flow" amount={results.netCashFlow} positive={results.netCashFlow >= 0} bold={true} />
              </div>

              <div style={{ ...card, background: '#f9fafb' }}>
                <div style={{ ...sec, color: '#9ca3af' }}>All-In Cost Breakdown</div>
                {[
                  ['Purchase Price', results.purchase],
                  ['Rehab Budget', results.rehab],
                  ['Purchase Closing Costs', results.purchaseClosingCosts],
                  ...(results.pointsCost > 0 ? [['Loan Points (' + loanPoints + '%)', results.pointsCost]] : []),
                  ['Private Money Interest (' + holdingMonths + 'mo @ ' + privateRate + '%)', results.holdingCost],
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
