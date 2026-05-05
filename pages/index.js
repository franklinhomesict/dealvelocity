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
  if (cashOut && cf >= 0)   return 'Home Run';
  if (!cashOut && cf >= 100) return 'Triple';
  if (!cashOut && cf >= 0)   return 'Double';
  return 'Needs Work';
};

export default function Home() {
  const [tab, setTab] = useState('brrrr');
  const [dark, setDark] = useState(true);

  const [purchasePrice,  setPurchasePrice]  = useState('');
  const [rehabBudget,    setRehabBudget]    = useState('');
  const [arv,            setArv]            = useState('');
  const [monthlyRent,    setMonthlyRent]    = useState('');
  const [otherIncome,    setOtherIncome]    = useState('0');
  const [holdingMonths,  setHoldingMonths]  = useState('4');
  const [privateRate,    setPrivateRate]    = useState('12');
  const [loanPoints,     setLoanPoints]     = useState('2');
  const [privateLoanAmt, setPrivateLoanAmt] = useState('');
  const [refiRate,       setRefiRate]       = useState('7.5');
  const [targetCashOut,  setTargetCashOut]  = useState('20000');
  const [vacancyPct,     setVacancyPct]     = useState('8');
  const [capexPct,       setCapexPct]       = useState('5');
  const [pmPct,          setPmPct]          = useState('0');
  const [maintenancePct, setMaintenancePct] = useState('5');
  const [results,        setResults]        = useState(null);

  const [fPurchase,     setFPurchase]     = useState('');
  const [fRehab,        setFRehab]        = useState('');
  const [fArv,          setFArv]          = useState('');
  const [fRate,         setFRate]         = useState('12');
  const [fPoints,       setFPoints]       = useState('2');
  const [fPrivateLoan,  setFPrivateLoan]  = useState('');
  const [fSellingCosts, setFSellingCosts] = useState('8');
  const [fMonths,       setFMonths]       = useState('6');
  const [fTargetProfit, setFTargetProfit] = useState('20000');
  const [fResults,      setFResults]      = useState(null);

  const [wArv,           setWArv]           = useState('');
  const [wBuyerRehab,    setWBuyerRehab]    = useState('');
  const [wContractPrice, setWContractPrice] = useState('');
  const [wTargetCO,      setWTargetCO]      = useState('20000');
  const [wBuyerPoints,   setWBuyerPoints]   = useState('2');
  const [wBuyerRate,     setWBuyerRate]     = useState('18');
  const [wBuyerMonths,   setWBuyerMonths]   = useState('4');
  const [wFlipProfit,    setWFlipProfit]    = useState('20000');
  const [wFlipSelling,   setWFlipSelling]   = useState('8');
  const [wResults,       setWResults]       = useState(null);

  const [cSellerBalance, setCSellerBalance] = useState('');
  const [cSellerPI,      setCSellerPI]      = useState('');
  const [cDownToSeller,  setCDownToSeller]  = useState('');
  const [cWrapLoan,      setCWrapLoan]      = useState('');
  const [cWrapRate,      setCWrapRate]      = useState('');
  const [cBuyerDown,     setCBuyerDown]     = useState('');
  const [cHoldYrs,       setCHoldYrs]       = useState('5');
  const [cResults,       setCResults]       = useState(null);

  const analyzeBRRRR = () => {
    const purchase = parseFloat(purchasePrice) || 0;
    const rehab    = parseFloat(rehabBudget)   || 0;
    const arvVal   = parseFloat(arv)           || 0;
    const rent     = parseFloat(monthlyRent)   || 0;
    const other    = parseFloat(otherIncome)   || 0;
    const months   = Math.max(parseFloat(holdingMonths) || 4, 3);
    const privRate = parseFloat(privateRate)   / 100;
    const points   = parseFloat(loanPoints)    / 100 || 0;
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
    setResults({ purchase, rehab, pointsCost, holdingCost, totalAllIn,
      refiLoan75, refiClosing75, cashLeftIn75, pi75, piti75, netCF75, coC75,
      refiLoan80, refiClosing80, cashLeftIn80, pi80, piti80, netCF80, coC80,
      taxes, insurance, grossIncome, rent, other, expenseAmt,
      vacancyAmt: rent*vacancy, capexAmt: rent*capex, pmAmt: rent*pm, maintAmt: rent*maint,
      mao75target, mao75zero, mao80zero, vsMAO, arvVal, target, months,
      rateStr: privateRate, ptsStr: loanPoints });
  };

  const analyzeFlip = () => {
    const purchase     = parseFloat(fPurchase) || 0;
    const rehab        = parseFloat(fRehab)    || 0;
    const arvVal       = parseFloat(fArv)      || 0;
    const months       = Math.max(parseFloat(fMonths) || 6, 1);
    const privRate     = parseFloat(fRate) / 100;
    const points       = parseFloat(fPoints) / 100 || 0;
    const sellingPct   = parseFloat(fSellingCosts) / 100 || 0.08;
    const targetProfit = parseFloat(fTargetProfit) || 0;
    const privateLoan  = parseFloat(fPrivateLoan) || (purchase + rehab);
    const pointsCost   = privateLoan * points;
    const holdingCost  = privateLoan * (privRate / 12) * months;
    const totalAllIn   = purchase + rehab + PURCHASE_CLOSING + pointsCost + holdingCost;
    const sellingCosts  = arvVal * sellingPct;
    const netProfit     = arvVal - totalAllIn - sellingCosts;
    const roi           = totalAllIn > 0 ? netProfit / totalAllIn : 0;
    const annualizedRoi = months > 0 ? roi / (months / 12) : 0;
    const holdFactor    = 1 + points + (privRate / 12) * months;
    const netProceeds   = arvVal * (1 - sellingPct);
    const maoTarget     = (netProceeds - PURCHASE_CLOSING - targetProfit) / holdFactor - rehab;
    const maoBreakEven  = (netProceeds - PURCHASE_CLOSING) / holdFactor - rehab;
    const mao70pct      = arvVal * 0.70 - rehab;
    const vsMAO         = purchase > 0 && maoTarget > 0 ? purchase - maoTarget : null;
    setFResults({ purchase, rehab, arvVal, pointsCost, holdingCost, totalAllIn,
      sellingCosts, netProfit, roi, annualizedRoi,
      maoTarget, maoBreakEven, mao70pct, vsMAO, months, sellingPct, targetProfit });
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
    const bestMAO = Math.min(brrrMAO > 0 ? brrrMAO : Infinity, flipMAO > 0 ? flipMAO : Infinity);
    const brrrAssignment = contractPrice > 0 && brrrMAO > 0 ? brrrMAO - contractPrice : null;
    const flipAssignment  = contractPrice > 0 && flipMAO  > 0 ? flipMAO  - contractPrice : null;
    setWResults({ arvVal, buyerRehab, contractPrice, refiLoan75, refiClosing75,
      brrrMAO, brrrMAOzero, flipMAO, flipMAOzero, flip70,
      bestMAO, brrrAssignment, flipAssignment, targetCO, flipTarget });
  };

  const analyzeCreative = () => {
    const sellerBalance  = parseFloat(cSellerBalance) || 0;
    const sellerPI       = parseFloat(cSellerPI)      || 0;
    const downToSeller   = parseFloat(cDownToSeller)  || 0;
    const wrapLoan       = parseFloat(cWrapLoan)      || sellerBalance;
    const wrapRate       = parseFloat(cWrapRate)      || 0;
    const buyerDown      = parseFloat(cBuyerDown)     || 0;
    const holdYrs        = parseFloat(cHoldYrs)       || 5;
    const buyerPI         = calcPI(wrapLoan, wrapRate, 30);
    const monthlySpread   = buyerPI - sellerPI;
    const upfrontProfit   = buyerDown - downToSeller;
    const annualSpread    = monthlySpread * 12;
    const projectedProfit = upfrontProfit + monthlySpread * 12 * holdYrs;
    const wrapMarkup      = wrapLoan - sellerBalance;
    setCResults({ sellerBalance, sellerPI, downToSeller, wrapLoan, wrapRate,
      buyerDown, buyerPI, monthlySpread, upfrontProfit, annualSpread,
      projectedProfit, wrapMarkup, holdYrs });
  };

  const T = dark ? {
    page:'#0d0d0d', card:'#1a1a1a', cardBorder:'#2a2a2a', cardSub:'#111',
    text:'#e5e7eb', textMuted:'#9ca3af', textFaint:'#6b7280',
    inp:'#222', inpBorder:'#333', inpText:'#e5e7eb', rowBorder:'#222'
  } : {
    page:'#f9fafb', card:'#ffffff', cardBorder:'#e5e7eb', cardSub:'#f3f4f6',
    text:'#111827', textMuted:'#6b7280', textFaint:'#9ca3af',
    inp:'#ffffff', inpBorder:'#d1d5db', inpText:'#111827', rowBorder:'#f3f4f6'
  };

  const Inp = ({ label, value, onChange, prefix, suffix }) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:11, color:T.textMuted, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', background:T.inp, border:'1px solid '+T.inpBorder, borderRadius:8, overflow:'hidden' }}>
        {prefix && <span style={{ padding:'0 10px', color:T.textMuted, fontSize:13 }}>{prefix}</span>}
        <input type="number" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
          style={{ flex:1, background:'transparent', border:'none', outline:'none', padding:'9px 10px', color:T.inpText, fontSize:14 }} />
        {suffix && <span style={{ padding:'0 10px', color:T.textMuted, fontSize:13 }}>{suffix}</span>}
      </div>
    </div>
  );

  const MaoCard = ({ title, subtitle, scenarios, vsMAO, footer }) => (
    <div style={{ background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:12, padding:'18px 20px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#e5e7eb' }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{subtitle}</div>}
        </div>
        {vsMAO !== null && vsMAO !== undefined && (
          <div style={{ background:vsMAO<=0?'#052e16':'#2d1010', border:'1px solid '+(vsMAO<=0?'#166534':'#7f1d1d'), borderRadius:8, padding:'4px 10px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:vsMAO<=0?'#4ade80':'#f87171', textTransform:'uppercase' }}>Asking vs Target MAO</div>
            <div style={{ fontSize:15, fontWeight:700, color:vsMAO<=0?'#22c55e':'#ef4444' }}>
              {vsMAO<=0 ? fmt(Math.abs(vsMAO))+' under' : fmt(vsMAO)+' over'}
            </div>
          </div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {scenarios.map((s,i)=>(
          <div key={i} style={{ background:'#111', border:'1px solid #1a1a1a', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:s.value>0?'#22c55e':'#ef4444' }}>{s.value>0?fmt(s.value):'N/A'}</div>
            {s.note && <div style={{ fontSize:10, color:'#4b5563', marginTop:3 }}>{s.note}</div>}
          </div>
        ))}
      </div>
      {footer && <div style={{ fontSize:11, color:'#4b5563', marginTop:10 }}>{footer}</div>}
    </div>
  );

  const Row = ({ label, value, green, red, bold }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid '+T.rowBorder }}>
      <span style={{ fontSize:13, color:T.textMuted }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:bold?700:500, color:green?'#22c55e':red?'#ef4444':T.text }}>{value}</span>
    </div>
  );

  const Card = ({ children, style }) => (
    <div style={{ background:T.card, border:'1px solid '+T.cardBorder, borderRadius:12, padding:20, marginBottom:14, ...style }}>{children}</div>
  );

  const Sec = ({ children }) => (
    <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>{children}</div>
  );

  const Btn = ({ onClick, children }) => (
    <button onClick={onClick} style={{ width:'100%', padding:14, background:'#22c55e', color:'#000', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer', marginTop:4 }}>{children}</button>
  );

  return (
    <div style={{ minHeight:'100vh', background:T.page, color:T.text, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ background:'#111', borderBottom:'1px solid #1f1f1f', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'#22c55e', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:14 }}>&#x26A1;</span>
          </div>
          <span style={{ fontSize:16, fontWeight:700, color:'#fff' }}>DealVelocity</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {[['brrrr','BRRRR'],['flip','Flip'],['wholesale','Wholesale'],['creative','Creative / Wrap']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ background:'none', border:'none', cursor:'pointer', padding:'18px 14px', color:tab===id?'#22c55e':'#6b7280', borderBottom:tab===id?'2px solid #22c55e':'2px solid transparent', fontSize:13, fontWeight:tab===id?600:400 }}>{label}</button>
          ))}
          <button onClick={()=>setDark(d=>!d)} style={{ background:dark?'#222':'#e5e7eb', border:'none', borderRadius:20, padding:'5px 14px', color:dark?'#e5e7eb':'#374151', fontSize:12, cursor:'pointer', marginLeft:8 }}>
            {dark?'Light':'Dark'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 20px' }}>

        {tab==='brrrr' && (
          <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
            <div>
              <Card><Sec>Property</Sec>
                <Inp label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} prefix="$" />
                <Inp label="Rehab Budget" value={rehabBudget} onChange={setRehabBudget} prefix="$" />
                <Inp label="After Repair Value (ARV)" value={arv} onChange={setArv} prefix="$" />
              </Card>
              <Card><Sec>Private Money</Sec>
                <Inp label="Loan Amount (blank = purchase+rehab)" value={privateLoanAmt} onChange={setPrivateLoanAmt} prefix="$" />
                <Inp label="Interest Rate" value={privateRate} onChange={setPrivateRate} suffix="%" />
                <Inp label="Points" value={loanPoints} onChange={setLoanPoints} suffix="%" />
                <Inp label="Hold Period" value={holdingMonths} onChange={setHoldingMonths} suffix="mo" />
              </Card>
              <Card><Sec>Refinance</Sec>
                <Inp label="Refi Rate" value={refiRate} onChange={setRefiRate} suffix="%" />
                <Inp label="Target Cash-Out" value={targetCashOut} onChange={setTargetCashOut} prefix="$" />
              </Card>
              <Card><Sec>Rental Income</Sec>
                <Inp label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} prefix="$" />
                <Inp label="Other Income" value={otherIncome} onChange={setOtherIncome} prefix="$" />
              </Card>
              <Card><Sec>Operating Expenses</Sec>
                <Inp label="Vacancy" value={vacancyPct} onChange={setVacancyPct} suffix="%" />
                <Inp label="CapEx" value={capexPct} onChange={setCapexPct} suffix="%" />
                <Inp label="Property Mgmt" value={pmPct} onChange={setPmPct} suffix="%" />
                <Inp label="Maintenance" value={maintenancePct} onChange={setMaintenancePct} suffix="%" />
              </Card>
              <Btn onClick={analyzeBRRRR}>Analyze BRRRR</Btn>
            </div>
            <div>
              {!results ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:T.textFaint, fontSize:14 }}>Fill in the inputs and click Analyze</div>
              ) : (
                <>
                  <MaoCard title="Max Allowable Offer (MAO)"
                    subtitle={results.rateStr+'% rate / '+results.ptsStr+' pts / '+results.months+'mo hold'}
                    vsMAO={results.vsMAO}
                    scenarios={[
                      { label:'75% Cash-Out + Target', value:results.mao75target, note:fmt(results.target)+' cash out' },
                      { label:'75% Cash-Out Break-Even', value:results.mao75zero, note:'all cash recovered' },
                      { label:'80% Rate & Term', value:results.mao80zero, note:'rate & term only' },
                    ]}
                    footer="MAO = (refi loan - refi closing - purchase closing - target) / hold factor - rehab"
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <Card><Sec>75% Cash-Out Refi</Sec>
                      <Row label="Refi Loan (75%)" value={fmt(results.refiLoan75)} />
                      <Row label="Est. Refi Closing" value={fmt(results.refiClosing75)} />
                      <Row label="Cash Left In" value={fmt(results.cashLeftIn75)} green={results.cashLeftIn75<=0} red={results.cashLeftIn75>0} bold />
                      <Row label="Monthly P&I" value={fmt(results.pi75)} />
                      <Row label="PITI" value={fmt(results.piti75)} />
                      <Row label="Net Cash Flow" value={fmt(results.netCF75)} green={results.netCF75>=0} red={results.netCF75<0} bold />
                      {results.coC75!==null && <Row label="Cash-on-Cash" value={pct(results.coC75)} green={results.coC75>=0.08} />}
                      <div style={{ marginTop:10, padding:'8px 12px', background:'#0f2218', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontSize:11, color:'#4ade80' }}>{brrrRating(results.netCF75, results.cashLeftIn75<=0)}</div>
                      </div>
                    </Card>
                    <Card><Sec>80% Rate & Term Refi</Sec>
                      <Row label="Refi Loan (80%)" value={fmt(results.refiLoan80)} />
                      <Row label="Est. Refi Closing" value={fmt(results.refiClosing80)} />
                      <Row label="Cash Left In" value={fmt(results.cashLeftIn80)} green={results.cashLeftIn80<=0} red={results.cashLeftIn80>0} bold />
                      <Row label="Monthly P&I" value={fmt(results.pi80)} />
                      <Row label="PITI" value={fmt(results.piti80)} />
                      <Row label="Net Cash Flow" value={fmt(results.netCF80)} green={results.netCF80>=0} red={results.netCF80<0} bold />
                      {results.coC80!==null && <Row label="Cash-on-Cash" value={pct(results.coC80)} green={results.coC80>=0.08} />}
                      <div style={{ marginTop:10, padding:'8px 12px', background:'#0f2218', borderRadius:8, textAlign:'center' }}>
                        <div style={{ fontSize:11, color:'#4ade80' }}>{brrrRating(results.netCF80, results.cashLeftIn80<=0)}</div>
                      </div>
                    </Card>
                  </div>
                  <Card><Sec>All-In Cost Summary</Sec>
                    <Row label="Purchase Price" value={fmt(results.purchase)} />
                    <Row label="Rehab Budget" value={fmt(results.rehab)} />
                    <Row label="Purchase Closing" value={fmt(PURCHASE_CLOSING)} />
                    <Row label="Points Cost" value={fmt(results.pointsCost)} />
                    <Row label="Holding Cost" value={fmt(results.holdingCost)} />
                    <Row label="Total All-In" value={fmt(results.totalAllIn)} bold />
                  </Card>
                  <Card><Sec>Monthly Expense Detail</Sec>
                    <Row label="Gross Income" value={fmt(results.grossIncome)} />
                    <Row label="Taxes (est.)" value={fmt(results.taxes)} />
                    <Row label="Insurance (est.)" value={fmt(results.insurance)} />
                    <Row label="Vacancy" value={fmt(results.vacancyAmt)} />
                    <Row label="CapEx" value={fmt(results.capexAmt)} />
                    <Row label="Prop. Mgmt" value={fmt(results.pmAmt)} />
                    <Row label="Maintenance" value={fmt(results.maintAmt)} />
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

        {tab==='flip' && (
          <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
            <div>
              <Card><Sec>Property</Sec>
                <Inp label="Purchase Price" value={fPurchase} onChange={setFPurchase} prefix="$" />
                <Inp label="Rehab Budget" value={fRehab} onChange={setFRehab} prefix="$" />
                <Inp label="After Repair Value (ARV)" value={fArv} onChange={setFArv} prefix="$" />
              </Card>
              <Card><Sec>Private Money</Sec>
                <Inp label="Loan Amount (blank = purchase+rehab)" value={fPrivateLoan} onChange={setFPrivateLoan} prefix="$" />
                <Inp label="Interest Rate" value={fRate} onChange={setFRate} suffix="%" />
                <Inp label="Points" value={fPoints} onChange={setFPoints} suffix="%" />
                <Inp label="Hold Period" value={fMonths} onChange={setFMonths} suffix="mo" />
              </Card>
              <Card><Sec>Sale</Sec>
                <Inp label="Selling Costs %" value={fSellingCosts} onChange={setFSellingCosts} suffix="%" />
                <Inp label="Target Profit" value={fTargetProfit} onChange={setFTargetProfit} prefix="$" />
              </Card>
              <Btn onClick={analyzeFlip}>Analyze Flip</Btn>
            </div>
            <div>
              {!fResults ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:T.textFaint, fontSize:14 }}>Fill in the inputs and click Analyze</div>
              ) : (
                <>
                  <MaoCard title="Max Allowable Offer (MAO)"
                    subtitle={(fResults.sellingPct*100).toFixed(0)+'% selling / '+fResults.months+'mo hold'}
                    vsMAO={fResults.vsMAO}
                    scenarios={[
                      { label:'Target Profit', value:fResults.maoTarget, note:fmt(fResults.targetProfit)+' profit' },
                      { label:'Break-Even', value:fResults.maoBreakEven, note:'zero profit' },
                      { label:'70% Rule', value:fResults.mao70pct, note:'ARV x 70% - rehab' },
                    ]}
                    footer="Target MAO = (net proceeds - purchase closing - target profit) / hold factor - rehab"
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <Card><Sec>P&amp;L Summary</Sec>
                      <Row label="Sale Price (ARV)" value={fmt(fResults.arvVal)} />
                      <Row label="Selling Costs" value={fmt(fResults.sellingCosts)} />
                      <Row label="Total All-In" value={fmt(fResults.totalAllIn)} />
                      <Row label="Net Profit" value={fmt(fResults.netProfit)} green={fResults.netProfit>=0} red={fResults.netProfit<0} bold />
                      <Row label="ROI" value={pct(fResults.roi)} green={fResults.roi>=0.15} />
                      <Row label="Annualized ROI" value={pct(fResults.annualizedRoi)} green={fResults.annualizedRoi>=0.20} />
                    </Card>
                    <Card><Sec>Cost Breakdown</Sec>
                      <Row label="Purchase Price" value={fmt(fResults.purchase)} />
                      <Row label="Rehab Budget" value={fmt(fResults.rehab)} />
                      <Row label="Purchase Closing" value={fmt(PURCHASE_CLOSING)} />
                      <Row label="Points Cost" value={fmt(fResults.pointsCost)} />
                      <Row label="Holding Cost" value={fmt(fResults.holdingCost)} />
                      <Row label="Total All-In" value={fmt(fResults.totalAllIn)} bold />
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab==='wholesale' && (
          <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
            <div>
              <Card><Sec>Property</Sec>
                <Inp label="ARV" value={wArv} onChange={setWArv} prefix="$" />
                <Inp label="Buyer's Estimated Rehab" value={wBuyerRehab} onChange={setWBuyerRehab} prefix="$" />
                <Inp label="Your Contract Price" value={wContractPrice} onChange={setWContractPrice} prefix="$" />
              </Card>
              <Card><Sec>BRRRR Buyer Assumptions</Sec>
                <Inp label="Buyer's Target Cash-Out" value={wTargetCO} onChange={setWTargetCO} prefix="$" />
                <Inp label="Buyer's Private Money Rate" value={wBuyerRate} onChange={setWBuyerRate} suffix="%" />
                <Inp label="Buyer's Points" value={wBuyerPoints} onChange={setWBuyerPoints} suffix="%" />
                <Inp label="Buyer's Hold Period" value={wBuyerMonths} onChange={setWBuyerMonths} suffix="mo" />
              </Card>
              <Card><Sec>Flip Buyer Assumptions</Sec>
                <Inp label="Buyer's Target Profit" value={wFlipProfit} onChange={setWFlipProfit} prefix="$" />
                <Inp label="Buyer's Selling Costs" value={wFlipSelling} onChange={setWFlipSelling} suffix="%" />
              </Card>
              <Btn onClick={analyzeWholesale}>Calculate Assignment Fee</Btn>
            </div>
            <div>
              {!wResults ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:T.textFaint, fontSize:14 }}>Fill in the inputs and click Calculate</div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                    <div style={{ background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:12, padding:'18px 20px' }}>
                      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>BRRRR Buyer MAO</div>
                      <div style={{ fontSize:28, fontWeight:800, color:wResults.brrrMAO>0?'#22c55e':'#ef4444', marginBottom:6 }}>{wResults.brrrMAO>0?fmt(wResults.brrrMAO):'N/A'}</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>at {fmt(wResults.targetCO)} cash-out target</div>
                      <Row label="Break-Even MAO" value={wResults.brrrMAOzero>0?fmt(wResults.brrrMAOzero):'N/A'} />
                      <Row label="75% Refi Loan" value={fmt(wResults.refiLoan75)} />
                      <Row label="Est. Refi Closing" value={fmt(wResults.refiClosing75)} />
                      {wResults.brrrAssignment!==null && (
                        <div style={{ marginTop:12, padding:'10px 14px', background:wResults.brrrAssignment>=0?'#052e16':'#2d1010', borderRadius:8, textAlign:'center' }}>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>Your Assignment Fee</div>
                          <div style={{ fontSize:22, fontWeight:800, color:wResults.brrrAssignment>=0?'#22c55e':'#ef4444' }}>{fmt(wResults.brrrAssignment)}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:12, padding:'18px 20px' }}>
                      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>Flip Buyer MAO</div>
                      <div style={{ fontSize:28, fontWeight:800, color:wResults.flipMAO>0?'#22c55e':'#ef4444', marginBottom:6 }}>{wResults.flipMAO>0?fmt(wResults.flipMAO):'N/A'}</div>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>at {fmt(wResults.flipTarget)} profit target</div>
                      <Row label="Break-Even MAO" value={wResults.flipMAOzero>0?fmt(wResults.flipMAOzero):'N/A'} />
                      <Row label="70% Rule MAO" value={wResults.flip70>0?fmt(wResults.flip70):'N/A'} />
                      {wResults.flipAssignment!==null && (
                        <div style={{ marginTop:12, padding:'10px 14px', background:wResults.flipAssignment>=0?'#052e16':'#2d1010', borderRadius:8, textAlign:'center' }}>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>Your Assignment Fee</div>
                          <div style={{ fontSize:22, fontWeight:800, color:wResults.flipAssignment>=0?'#22c55e':'#ef4444' }}>{fmt(wResults.flipAssignment)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Card><Sec>Conservative Offer (Lower of Both MAOs)</Sec>
                    <div style={{ fontSize:32, fontWeight:800, color:wResults.bestMAO<Infinity&&wResults.bestMAO>0?'#22c55e':'#ef4444' }}>
                      {wResults.bestMAO<Infinity&&wResults.bestMAO>0?fmt(wResults.bestMAO):'N/A'}
                    </div>
                    <div style={{ fontSize:12, color:T.textFaint, marginTop:6 }}>Offer at or below this so either a BRRRR or Flip buyer can profitably close.</div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

        {tab==='creative' && (
          <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
            <div>
              <Card><Sec>Seller's Existing Loan</Sec>
                <Inp label="Remaining Loan Balance" value={cSellerBalance} onChange={setCSellerBalance} prefix="$" />
                <Inp label="Seller's Monthly P&I" value={cSellerPI} onChange={setCSellerPI} prefix="$" />
                <Inp label="Down Payment to Seller" value={cDownToSeller} onChange={setCDownToSeller} prefix="$" />
              </Card>
              <Card><Sec>Wrap / Subject-To Terms</Sec>
                <Inp label="Wrap Loan Amount (blank = seller balance)" value={cWrapLoan} onChange={setCWrapLoan} prefix="$" />
                <Inp label="Wrap Rate (buyer pays)" value={cWrapRate} onChange={setCWrapRate} suffix="%" />
                <Inp label="Down Payment from Your Buyer" value={cBuyerDown} onChange={setCBuyerDown} prefix="$" />
                <Inp label="Projected Hold Period" value={cHoldYrs} onChange={setCHoldYrs} suffix="yrs" />
              </Card>
              <Btn onClick={analyzeCreative}>Analyze Creative Deal</Btn>
            </div>
            <div>
              {!cResults ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:T.textFaint, fontSize:14 }}>Fill in the inputs and click Analyze</div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
                    {[
                      { label:'Monthly Spread', value:fmt(cResults.monthlySpread), color:cResults.monthlySpread>=0?'#22c55e':'#ef4444', sub:'buyer P&I - seller P&I' },
                      { label:'Upfront Profit', value:fmt(cResults.upfrontProfit), color:cResults.upfrontProfit>=0?'#22c55e':'#ef4444', sub:'down received - paid out' },
                      { label:cResults.holdYrs+'-Year Profit', value:fmt(cResults.projectedProfit), color:cResults.projectedProfit>=0?'#22c55e':'#ef4444', sub:'upfront + spread' },
                    ].map((s,i)=>(
                      <div key={i} style={{ background:'#0a0a0a', border:'1px solid #1f1f1f', borderRadius:12, padding:'16px 18px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{s.label}</div>
                        <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:11, color:'#4b5563', marginTop:4 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  <Card><Sec>Payment Details</Sec>
                    <Row label="Seller's Monthly P&I (you pay)" value={fmt(cResults.sellerPI)} />
                    <Row label="Wrap Loan" value={fmt(cResults.wrapLoan)} />
                    <Row label="Buyer's Monthly P&I (you receive)" value={fmt(cResults.buyerPI)} />
                    <Row label="Monthly Spread" value={fmt(cResults.monthlySpread)} green={cResults.monthlySpread>=0} red={cResults.monthlySpread<0} bold />
                    <Row label="Annual Spread" value={fmt(cResults.annualSpread)} green={cResults.annualSpread>=0} />
                    <Row label="Wrap Markup" value={fmt(cResults.wrapMarkup)} />
                  </Card>
                  <Card><Sec>Projected Profit by Year</Sec>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                      {[1,2,3,5,10].map(yr=>{
                        const val = cResults.upfrontProfit + cResults.monthlySpread*12*yr;
                        return (
                          <div key={yr} style={{ background:T.cardSub, borderRadius:8, padding:'10px 8px', textAlign:'center' }}>
                            <div style={{ fontSize:11, color:T.textFaint, marginBottom:4 }}>Yr {yr}</div>
                            <div style={{ fontSize:15, fontWeight:700, color:val>=0?'#22c55e':'#ef4444' }}>{fmt(val)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
