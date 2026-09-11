const KEY_PREFIX = 'secure_store_mock_';

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    return raw === null ? null : raw;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(KEY_PREFIX + key, value);
  } catch {
    // ignore
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    // ignore
  }
}

export default { getItemAsync, setItemAsync, deleteItemAsync };
