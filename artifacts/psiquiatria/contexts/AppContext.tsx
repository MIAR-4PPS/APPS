import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Section {
  id: string;
  title: string;
  type: "medicacao" | "consultas" | "evolucao" | "exames" | "custom";
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  birthDate?: string;
  diagnosis?: string;
  notes?: string;
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  patients: Patient[];
  isLoading: boolean;
  addPatient: (
    data: Omit<Patient, "id" | "sections" | "createdAt" | "updatedAt">
  ) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  getPatient: (id: string) => Patient | undefined;
  addSection: (
    patientId: string,
    data: Omit<Section, "id" | "createdAt" | "updatedAt">
  ) => Promise<Section>;
  updateSection: (
    patientId: string,
    sectionId: string,
    data: Partial<Section>
  ) => Promise<void>;
  deleteSection: (patientId: string, sectionId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = userId ? `psiapp_patients_${userId}` : null;

  useEffect(() => {
    if (!storageKey) {
      setPatients([]);
      setIsLoading(false);
      return;
    }
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) {
        try {
          setPatients(JSON.parse(raw));
        } catch {
          setPatients([]);
        }
      }
      setIsLoading(false);
    });
  }, [storageKey]);

  const save = useCallback(
    async (updated: Patient[]) => {
      setPatients(updated);
      if (storageKey) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      }
    },
    [storageKey]
  );

  const addPatient = useCallback(
    async (
      data: Omit<Patient, "id" | "sections" | "createdAt" | "updatedAt">
    ) => {
      const now = new Date().toISOString();
      const patient: Patient = {
        ...data,
        id: makeId(),
        sections: [],
        createdAt: now,
        updatedAt: now,
      };
      await save([...patients, patient]);
      return patient;
    },
    [patients, save]
  );

  const updatePatient = useCallback(
    async (id: string, data: Partial<Patient>) => {
      await save(
        patients.map((p) =>
          p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
        )
      );
    },
    [patients, save]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      await save(patients.filter((p) => p.id !== id));
    },
    [patients, save]
  );

  const getPatient = useCallback(
    (id: string) => patients.find((p) => p.id === id),
    [patients]
  );

  const addSection = useCallback(
    async (
      patientId: string,
      data: Omit<Section, "id" | "createdAt" | "updatedAt">
    ) => {
      const now = new Date().toISOString();
      const section: Section = { ...data, id: makeId(), createdAt: now, updatedAt: now };
      await save(
        patients.map((p) =>
          p.id === patientId
            ? { ...p, sections: [...p.sections, section], updatedAt: now }
            : p
        )
      );
      return section;
    },
    [patients, save]
  );

  const updateSection = useCallback(
    async (patientId: string, sectionId: string, data: Partial<Section>) => {
      const now = new Date().toISOString();
      await save(
        patients.map((p) =>
          p.id === patientId
            ? {
                ...p,
                updatedAt: now,
                sections: p.sections.map((s) =>
                  s.id === sectionId ? { ...s, ...data, updatedAt: now } : s
                ),
              }
            : p
        )
      );
    },
    [patients, save]
  );

  const deleteSection = useCallback(
    async (patientId: string, sectionId: string) => {
      const now = new Date().toISOString();
      await save(
        patients.map((p) =>
          p.id === patientId
            ? {
                ...p,
                updatedAt: now,
                sections: p.sections.filter((s) => s.id !== sectionId),
              }
            : p
        )
      );
    },
    [patients, save]
  );

  return (
    <AppContext.Provider
      value={{
        patients,
        isLoading,
        addPatient,
        updatePatient,
        deletePatient,
        getPatient,
        addSection,
        updateSection,
        deleteSection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
