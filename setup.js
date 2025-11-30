const fs = require('fs');
const path = require('path');

// הגדרת מבנה הקבצים והתוכן שלהם
const files = {
  'package.json': JSON.stringify({
    name: "splitwise-clone",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    },
    dependencies: {
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "uuid": "^9.0.0"
    },
    devDependencies: {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "@types/uuid": "^9.0.0",
      "@vitejs/plugin-react": "^4.0.0",
      "typescript": "^5.0.2",
      "vite": "^4.3.0"
    }
  }, null, 2),

  'tsconfig.json': JSON.stringify({
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }, null, 2),

  'tsconfig.node.json': JSON.stringify({
    "compilerOptions": {
      "composite": true,
      "skipLibCheck": true,
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true
    },
    "include": ["vite.config.ts"]
  }, null, 2),

  'vite.config.ts': `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`,

  'index.html': `
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Splitwise Clone</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  'src/vite-env.d.ts': `/// <reference types="vite/client" />`,

  'src/main.tsx': `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,

  'src/index.css': `
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; }
* { box-sizing: border-box; }
`,

  'src/types.ts': `
export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  beneficiaryIds: string[];
  date: string;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  paid: number;
  share: number;
  balance: number;
}

export interface Transaction {
  from: string;
  to: string;
  amount: number;
}
`,

  'src/utils/finance.ts': `
import { Expense, Member, MemberBalance, Transaction } from "../types";

const round = (num: number) => Math.round(num * 100) / 100;

export const calculateBalances = (members: Member[], expenses: Expense[]): MemberBalance[] => {
  const balances: Record<string, MemberBalance> = {};

  members.forEach((m) => {
    balances[m.id] = { memberId: m.id, memberName: m.name, paid: 0, share: 0, balance: 0 };
  });

  expenses.forEach((expense) => {
    const amount = expense.amount;
    const payerId = expense.payerId;
    const beneficiaries = expense.beneficiaryIds;

    if (beneficiaries.length === 0) return;

    if (balances[payerId]) {
      balances[payerId].paid += amount;
    }

    const splitAmount = amount / beneficiaries.length;

    beneficiaries.forEach((benId) => {
      if (balances[benId]) {
        balances[benId].share += splitAmount;
      }
    });
  });

  return Object.values(balances).map((b) => ({
    ...b,
    paid: round(b.paid),
    share: round(b.share),
    balance: round(b.paid - b.share),
  }));
};

export const calculateMinimalTransactions = (balances: MemberBalance[]): Transaction[] => {
  let debtors = balances.filter((b) => b.balance < -0.01).map(b => ({ ...b }));
  let creditors = balances.filter((b) => b.balance > 0.01).map(b => ({ ...b }));

  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions: Transaction[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = round(Math.min(Math.abs(debtor.balance), creditor.balance));

    if (amount > 0) {
      transactions.push({
        from: debtor.memberName,
        to: creditor.memberName,
        amount: amount,
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) < 0.01) debtorIndex++;
    if (Math.abs(creditor.balance) < 0.01) creditorIndex++;
  }

  return transactions;
};
`,

  'src/components/GroupManager.tsx': `
import React, { useState } from 'react';
import { Member } from '../types';

interface Props {
  members: Member[];
  onAddMember: (name: string) => void;
  onRemoveMember: (id: string) => void;
}

export const GroupManager: React.FC<Props> = ({ members, onAddMember, onRemoveMember }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAddMember(name);
      setName('');
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', background: '#fff' }}>
      <h3>👥 ניהול קבוצה</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <input 
          type="text" 
          placeholder="שם החבר..." 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>הוסף</button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {members.map(m => (
          <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '8px 0' }}>
            {m.name}
            <button onClick={() => onRemoveMember(m.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
`,

  'src/components/ExpenseForm.tsx': `
import React, { useState, useEffect } from 'react';
import { Member, Expense } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  members: Member[];
  onAddExpense: (expense: Expense) => void;
}

export const ExpenseForm: React.FC<Props> = ({ members, onAddExpense }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);

  useEffect(() => {
    if (members.length > 0) {
      if (!payerId) setPayerId(members[0].id);
      setBeneficiaries(members.map(m => m.id));
    }
  }, [members]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !payerId || beneficiaries.length === 0) return;

    const newExpense: Expense = {
      id: uuidv4(),
      description,
      amount: parseFloat(amount),
      payerId,
      beneficiaryIds: beneficiaries,
      date: new Date().toISOString()
    };

    onAddExpense(newExpense);
    setDescription('');
    setAmount('');
  };

  const toggleBeneficiary = (id: string) => {
    setBeneficiaries(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  if (members.length < 2) return <div style={{padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #ddd'}}>נא להוסיף לפחות 2 חברים כדי להוסיף הוצאה.</div>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <h3>💸 הוספת הוצאה</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="על מה הוצאתם?" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          required
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <input 
          type="number" 
          placeholder="סכום (₪)" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          min="0"
          step="0.01"
          required
          style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        
        <div>
          <label style={{display:'block', marginBottom: '5px', fontSize: '0.9rem'}}>מי שילם?</label>
          <select value={payerId} onChange={e => setPayerId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{display:'block', marginBottom: '5px', fontSize: '0.9rem'}}>עבור מי? (ברירת מחדל: כולם)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
            {members.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #eee' }}>
                <input 
                  type="checkbox" 
                  checked={beneficiaries.includes(m.id)} 
                  onChange={() => toggleBeneficiary(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" style={{ padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}>הוסף הוצאה</button>
      </form>
    </div>
  );
};
`,

  'src/components/ExpenseList.tsx': `
import React from 'react';
import { Expense, Member } from '../types';

interface Props {
  expenses: Expense[];
  members: Member[];
  onDeleteExpense: (id: string) => void;
}

export const ExpenseList: React.FC<Props> = ({ expenses, members, onDeleteExpense }) => {
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  return (
    <div style={{ marginBottom: '2rem', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
      <h3>📜 היסטוריית הוצאות</h3>
      {expenses.length === 0 ? <p>אין הוצאות עדיין.</p> : (
        <div style={{overflowX: 'auto'}}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'right' }}>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>תיאור</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>מי שילם</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>סכום</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{exp.description}</td>
                  <td style={{ padding: '10px' }}>{getMemberName(exp.payerId)}</td>
                  <td style={{ padding: '10px' }}>₪{exp.amount}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                     <button onClick={() => onDeleteExpense(exp.id)} style={{ color: 'red', border: '1px solid red', borderRadius: '4px', background: 'white', cursor: 'pointer', padding: '2px 8px' }}>מחק</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
`,

  'src/components/Summary.tsx': `
import React from 'react';
import { MemberBalance, Transaction } from '../types';

interface Props {
  balances: MemberBalance[];
  transactions: Transaction[];
}

export const Summary: React.FC<Props> = ({ balances, transactions }) => {
  return (
    <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
      <h3>📊 סיכום מצב</h3>
      
      <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '300px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ textAlign: 'right', padding: '8px' }}>שם</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>שילם</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>צריכה</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>יתרה</th>
            </tr>
          </thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.memberId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{b.memberName}</td>
                <td style={{ padding: '8px' }}>₪{b.paid}</td>
                <td style={{ padding: '8px' }}>₪{b.share}</td>
                <td style={{ padding: '8px', color: b.balance >= 0 ? 'green' : 'red', fontWeight: 'bold', direction: 'ltr', textAlign: 'right' }}>
                  {b.balance >= 0 ? \`+\${b.balance}\` : b.balance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ backgroundColor: '#e3f2fd', padding: '1rem', borderRadius: '8px' }}>
        <h4 style={{ marginTop: 0, color: '#1565c0' }}>🔄 העברות מומלצות</h4>
        {transactions.length === 0 ? <p style={{color: '#555'}}>הכל מאוזן! אין חובות.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {transactions.map((t, idx) => (
              <li key={idx} style={{ padding: '8px 0', fontSize: '1rem', borderBottom: idx < transactions.length - 1 ? '1px dashed #bbdefb' : 'none' }}>
                <span style={{ fontWeight: 'bold' }}>{t.from}</span> משלם/ת ל-<span style={{ fontWeight: 'bold' }}>{t.to}</span>: <span style={{ fontWeight: 'bold', color: '#1976d2' }}>₪{t.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
`,

  'src/App.tsx': `
import { useState, useEffect, useMemo } from 'react';
import { GroupManager } from './components/GroupManager';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { Summary } from './components/Summary';
import { Member, Expense } from './types';
import { calculateBalances, calculateMinimalTransactions } from './utils/finance';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('members');
    return saved ? JSON.parse(saved) : [];
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  const addMember = (name: string) => {
    const newMember: Member = { id: uuidv4(), name };
    setMembers([...members, newMember]);
  };

  const removeMember = (id: string) => {
    const hasExpenses = expenses.some(e => e.payerId === id || e.beneficiaryIds.includes(id));
    if (hasExpenses) {
      alert("לא ניתן למחוק חבר שמשתתף בהוצאות קיימות.");
      return;
    }
    setMembers(members.filter(m => m.id !== id));
  };

  const addExpense = (expense: Expense) => {
    setExpenses([...expenses, expense]);
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const balances = useMemo(() => calculateBalances(members, expenses), [members, expenses]);
  const transactions = useMemo(() => calculateMinimalTransactions(balances), [balances]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', direction: 'rtl' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>💰 Split-It App</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        <div>
          <GroupManager members={members} onAddMember={addMember} onRemoveMember={removeMember} />
          <ExpenseForm members={members} onAddExpense={addExpense} />
        </div>
        
        <div>
           <Summary balances={balances} transactions={transactions} />
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ExpenseList expenses={expenses} members={members} onDeleteExpense={deleteExpense} />
      </div>
    </div>
  );
}

export default App;
`
};

// יצירת הקבצים
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  const dirName = path.dirname(fullPath);

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  fs.writeFileSync(fullPath, content.trim());
  console.log(`Created: ${filePath}`);
});

console.log('Done! Now run:');
console.log('1. npm install');
console.log('2. npm run dev');