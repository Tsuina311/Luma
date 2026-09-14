import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type DataRefreshContextValue = {
  revision: number;
  refresh: () => void;
};

const DataRefreshContext = createContext<DataRefreshContextValue | null>(null);

export function DataRefreshProvider({ children }: PropsWithChildren) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const value = useMemo(() => ({ revision, refresh }), [revision, refresh]);
  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefresh(): DataRefreshContextValue {
  const value = useContext(DataRefreshContext);
  if (!value) throw new Error('useDataRefresh must be used inside DataRefreshProvider.');
  return value;
}
