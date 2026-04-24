import { createContext, useContext, useState } from 'react';

const TenantContext = createContext(null);

export const useTenant = () => useContext(TenantContext);

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(() => {
    try {
      const saved = sessionStorage.getItem('fa_tenant');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const saveTenant = (t) => {
    sessionStorage.setItem('fa_tenant', JSON.stringify(t));
    setTenant(t);
  };

  const clearTenant = () => {
    sessionStorage.removeItem('fa_tenant');
    setTenant(null);
  };

  return (
    <TenantContext.Provider value={{ tenant, saveTenant, clearTenant }}>
      {children}
    </TenantContext.Provider>
  );
};
