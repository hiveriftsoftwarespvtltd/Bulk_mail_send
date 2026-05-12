export const randomFileNameUtil = () => {
  return Date.now() + '-' + Math.round(Math.random() * 1e9);
};
