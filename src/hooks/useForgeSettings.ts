import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { findPreset, normalizeBaseUrl, type ProviderModel } from '@/lib/provider';
import { DEFAULT_OPTIONS, type ForgeOptions } from '@/lib/promptEngine';

const CONNECTION_STORAGE = 'promptforge:connection';

export interface Connection {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  /** Model that forges the prompt. Chosen from the provider's model list. */
  crafterModel: string;
  /** Cached display name for the chosen crafter model. */
  crafterLabel: string;
}

export const DEFAULT_CONNECTION: Connection = {
  providerId: 'deepseek',
  baseUrl: findPreset('deepseek').baseUrl,
  apiKey: '',
  crafterModel: '',
  crafterLabel: '',
};

/**
 * BYOK connection settings. Stored only in this browser; requests go straight
 * from the page to the provider's API.
 */
export function useConnection() {
  const [connection, setConnection] = useLocalStorage<Connection>(CONNECTION_STORAGE, DEFAULT_CONNECTION);

  const update = useCallback(
    (patch: Partial<Connection>) => {
      setConnection((current) => ({ ...current, ...patch }));
    },
    [setConnection],
  );

  const selectProvider = useCallback(
    (providerId: string) => {
      const preset = findPreset(providerId);
      setConnection((current) => ({
        ...current,
        providerId,
        baseUrl: providerId === 'custom' ? current.baseUrl : preset.baseUrl,
        // Model ids are provider-specific; clear the selection when switching.
        crafterModel: '',
        crafterLabel: '',
      }));
    },
    [setConnection],
  );

  const selectModel = useCallback(
    (model: ProviderModel) => {
      setConnection((current) => ({ ...current, crafterModel: model.id, crafterLabel: model.name }));
    },
    [setConnection],
  );

  const disconnect = useCallback(() => {
    setConnection((current) => ({ ...current, apiKey: '', crafterModel: '', crafterLabel: '' }));
  }, [setConnection]);

  return {
    connection: { ...connection, baseUrl: normalizeBaseUrl(connection.baseUrl) },
    update,
    selectProvider,
    selectModel,
    disconnect,
  };
}

const PREFERENCES_STORAGE = 'promptforge:preferences';

export interface Preferences {
  options: ForgeOptions;
}

export const DEFAULT_PREFERENCES: Preferences = {
  options: DEFAULT_OPTIONS,
};

export function usePreferences() {
  const [preferences, setPreferences] = useLocalStorage<Preferences>(PREFERENCES_STORAGE, DEFAULT_PREFERENCES);

  const updateOptions = useCallback(
    (patch: Partial<ForgeOptions>) => {
      setPreferences((current) => ({
        ...current,
        options: { ...current.options, ...patch },
      }));
    },
    [setPreferences],
  );

  return { preferences, updateOptions };
}
