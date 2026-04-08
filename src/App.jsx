import { useState } from 'react';
import './styles/shared.css';

import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Accounting   from './pages/Accounting';
import Invoicing    from './pages/Invoicing';
import Purchases    from './pages/Purchases';
import Sales        from './pages/Sales';
import CRM          from './pages/CRM';
import Inventory    from './pages/Inventory';
import Projects     from './pages/Projects';
import Expenses     from './pages/Expenses';
import Documents    from './pages/Documents';
import Intelligence from './pages/Intelligence';
import AICopilot    from './pages/AICopilot';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const [page, setPage]           = useState('dashboard');

  function handleLogin() {
    setShowLogin(false);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setShowLogin(true);
    setPage('dashboard');
  }

  if (showLogin) {
    return <Login onLogin={handleLogin} />;
  }

  const goPage = (p) => setPage(p);

  return (
    <>
      {page === 'dashboard'    && <Dashboard    goPage={goPage} onLogout={handleLogout} />}
      {page === 'accounting'   && <Accounting   goPage={goPage} onLogout={handleLogout} />}
      {page === 'invoicing'    && <Invoicing    goPage={goPage} onLogout={handleLogout} />}
      {page === 'purchases'    && <Purchases    goPage={goPage} onLogout={handleLogout} />}
      {page === 'sales'        && <Sales        goPage={goPage} onLogout={handleLogout} />}
      {page === 'crm'          && <CRM          goPage={goPage} onLogout={handleLogout} />}
      {page === 'inventory'    && <Inventory    goPage={goPage} onLogout={handleLogout} />}
      {page === 'projects'     && <Projects     goPage={goPage} onLogout={handleLogout} />}
      {page === 'expenses'     && <Expenses     goPage={goPage} onLogout={handleLogout} />}
      {page === 'documents'    && <Documents    goPage={goPage} onLogout={handleLogout} />}
      {page === 'intelligence' && <Intelligence goPage={goPage} onLogout={handleLogout} />}
      {page === 'aicopilot'   && <AICopilot    goPage={goPage} onLogout={handleLogout} />}
    </>
  );
}

export default App;
