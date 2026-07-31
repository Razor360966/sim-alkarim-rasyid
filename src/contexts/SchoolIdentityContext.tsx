import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { APP_CONFIG, AppConfig } from "../config/appConfig";
import { schoolIdentityService } from "../services/schoolIdentity.service";

interface SchoolIdentityContextType {
  identity: AppConfig;
  isLoading: boolean;
  refreshIdentity: () => Promise<void>;
  updateIdentity: (newIdentity: Partial<AppConfig>) => Promise<void>;
}

const SchoolIdentityContext = createContext<SchoolIdentityContextType | undefined>(undefined);

export const SchoolIdentityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [identity, setIdentity] = useState<AppConfig>(APP_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchIdentity = useCallback(async () => {
    try {
      const data = await schoolIdentityService.getIdentity();
      setIdentity(data);
    } catch (error) {
      console.error("Error fetching school identity:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const updateIdentity = useCallback(async (newIdentity: Partial<AppConfig>) => {
    try {
      setIsLoading(true);
      const updated = await schoolIdentityService.updateIdentity(newIdentity);
      setIdentity((prev) => ({ ...prev, ...updated }));
    } catch (error) {
      console.error("Failed to update school identity:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <SchoolIdentityContext.Provider
      value={{
        identity,
        isLoading,
        refreshIdentity: fetchIdentity,
        updateIdentity
      }}
    >
      {children}
    </SchoolIdentityContext.Provider>
  );
};

export const useSchoolIdentity = () => {
  const context = useContext(SchoolIdentityContext);
  if (!context) {
    return {
      identity: APP_CONFIG,
      isLoading: false,
      refreshIdentity: async () => {},
      updateIdentity: async () => {}
    };
  }
  return context;
};
