import { useState } from 'react';

export default function Home() {
  const [address, setAddress] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [rehabBudget, setRehabBudget] = useState('');
  const [results, setResults] = useState(null);

  const calculate = () => {
    const purchase = parseFloat(purchasePrice) || 0;
    const rehab = parseFloat(rehabBudget) || 0;
    
    // Purchase closing costs (from your ALTA statements)
    const recordingFees = 400;
    const titleClosing = 340;
    const titleLenderPolicy = 266;
    const titleOwnerPolicy = 858;
    const purchaseClosingCosts = recordingFees + titleClosing + titleLenderPolicy + titleOwnerPolicy;
    
    // Total all-in
    const totalAllIn = purchase + rehab + purchaseClosingCosts;
    
    // Refi (75% LTV of ARV - assuming ARV = all-in for now)
    const refiLoanAmount = totalAllIn * 0.75;
    const refiRate = 0.07375;
    const refiClosingCosts = refiLoanAmount * 0.06; // ~6% total closing
    
    // Cash left in deal
    const cashLeftIn = totalAllIn - refiLoanAmount + refiClosingCosts;
    
    // Monthly payment (P&I + taxes + insurance)
    const monthlyPI = (refiLoanAmount * (refiRate / 12) * Math.pow(1 + refiRate / 12, 360)) / (Math.pow(1 + refiRate / 12, 360) - 1);
    const monthlyTaxes = (totalAllIn * 0.011) / 12; // 1.1% annual property tax
    const monthlyInsurance = totalAllIn * 0.0079 / 12; // 0.79% annual
    const monthlyPITI = monthlyPI + monthlyTaxes + monthlyInsurance;
    
    setResults({
      totalAllIn,
      refiLoanAmount,
      cashLeftIn,
      monthlyPITI,
      refiRate: (refiRate * 100).toFixed(2)
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 40, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8 }}>DealVelocity</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>BRRRR Deal Analyzer - Franklin Homes</p>
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Property Address</label>
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="1914 S Prescott Circle, Wichita KS"
          style={{ width: '100%', padding: 12, fontSize: 16, border: '2px solid #ddd', borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Purchase Price</label>
        <input 
          type="number" 
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="125000"
          style={{ width: '100%', padding: 12, fontSize: 16, border: '2px solid #ddd', borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Rehab Budget</label>
        <input 
          type="number" 
          value={rehabBudget}
          onChange={(e) => setRehabBudget(e.target.value)}
          placeholder="15000"
          style={{ width: '100%', padding: 12, fontSize: 16, border: '2px solid #ddd', borderRadius: 8 }}
        />
      </div>

      <button 
        onClick={calculate}
        style={{ 
          width: '100%', 
          padding: 16, 
          fontSize: 18, 
          fontWeight: 700, 
          background: '#000', 
          color: '#fff', 
          border: 'none', 
          borderRadius: 8, 
          cursor: 'pointer',
          marginBottom: 40
        }}
      >
        Analyze Deal
      </button>

      {results && (
        <div style={{ background: '#f5f5f5', padding: 30, borderRadius: 12 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Deal Summary</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, color: '#666' }}>Total All-In</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>${results.totalAllIn.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#666' }}>Refi Loan Amount (75% LTV)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>${results.refiLoanAmount.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#666' }}>Cash Left in Deal</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: results.cashLeftIn < 0 ? '#16a34a' : '#000' }}>
                ${Math.abs(results.cashLeftIn).toLocaleString()}
                {results.cashLeftIn < 0 && ' (cash out)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#666' }}>Monthly PITI @ {results.refiRate}%</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>${results.monthlyPITI.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
