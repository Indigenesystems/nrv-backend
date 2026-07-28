export const generateConfirmationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
