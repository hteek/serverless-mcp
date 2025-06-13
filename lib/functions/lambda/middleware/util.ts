export const getProcessEnv = (key: string, errorMessage: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
};
